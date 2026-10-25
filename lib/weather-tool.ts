import type { ChatRequest } from './chat-contract';

const SOURCE = {
  source: 'Open-Meteo' as const,
  sourceUrl: 'https://open-meteo.com/' as const,
};
const DAY = 86_400_000;
const MAX_BYTES = 32_768;
// The public provider can take more than five seconds from this PC. Keep a
// finite deadline covering both response headers and the streamed JSON body.
const WEATHER_TIMEOUT_MS = 12_000;
const locations = [
  { name: '서귀포', pattern: /서귀포/, latitude: 33.2541, longitude: 126.5601 },
  { name: '성산', pattern: /성산/, latitude: 33.462, longitude: 126.911 },
  { name: '협재', pattern: /협재/, latitude: 33.394, longitude: 126.239 },
  { name: '한림', pattern: /한림/, latitude: 33.414, longitude: 126.263 },
  { name: '애월', pattern: /애월/, latitude: 33.463, longitude: 126.31 },
  { name: '함덕', pattern: /함덕/, latitude: 33.543, longitude: 126.669 },
  { name: '서울', pattern: /서울/, latitude: 37.5665, longitude: 126.978 },
  { name: '제주', pattern: /제주/, latitude: 33.4996, longitude: 126.5312 },
] as const;
type WeatherLocation = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: 'Asia/Seoul';
};
type DailyWeather = {
  date: string;
  minTemperatureC: number;
  maxTemperatureC: number;
  maxPrecipitationProbability: number;
  maxWindSpeedMs: number;
  condition: string;
};
export type WeatherChatContext = {
  status:
    | 'ready'
    | 'asked-location'
    | 'unsupported-location'
    | 'unsupported-date'
    | 'unavailable';
  source: 'Open-Meteo';
  sourceUrl: 'https://open-meteo.com/';
  retrievedAt: string;
  location?: WeatherLocation;
  dates?: string[];
  facts?: {
    current?: {
      time: string;
      temperatureC: number;
      precipitationMm: number;
      windSpeedMs: number;
      condition: string;
    };
    daily: DailyWeather[];
  };
  instruction: string;
};
export type WeatherContext = WeatherChatContext;

const weatherWords =
  /날씨|기온|온도|강수|풍속|바람|예보|비\s*(?:가\s*)?(?:올|와|오니|오나|오겠)|눈\s*(?:이\s*)?(?:올|와|오니|오나)/;
const temporalWords =
  /오늘|내일|모레|지금|현재|이번\s*주|주말|일주일|한\s*주\s*(?:동안|간)|(?:\d+\s*일|하루|이틀|사흘|나흘|닷새|엿새|이레)\s*(?:간|동안)|\d{4}-\d{2}-\d{2}|\d+\s*월\s*\d+\s*일/;
const genericWeather =
  /비\s*(?:가\s*)?오(?:는\s*날|면)|비오는날|눈\s*(?:이\s*)?오(?:는\s*날|면)|바람\s*(?:이\s*)?부는\s*날|옷차림|계절|준비물|일반\s*준비|봄|여름|가을|겨울|장마철/;
const unsupportedLocations =
  /한라산|백록담|산\s*정상|마라도|우도|추자도|부산|대구|대전|광주|인천|울산|세종|수원|강릉|속초|춘천|여수|목포|전주|경주|포항|청주|천안|부여|공주|군산|울릉|독도|평창|거제|통영|완도|진도|남해|양양|가평|용인|파주|김포|고양|안동|도쿄|오사카|후쿠오카|삿포로|오키나와|방콕|다낭|하노이|타이베이|홍콩|싱가포르|뉴욕|파리|런던|로마|베를린|제네바|스위스|미국|일본|중국|유럽|중동|호주/;

function isWeatherQuestion(text: string) {
  if (genericWeather.test(text) && !temporalWords.test(text)) return false;
  // A conditional travel/clothing question does not itself request a forecast.
  if (
    /비\s*(?:가\s*)?오(?:는\s*날|면)|비오는날|옷차림|준비물/.test(text) &&
    !/날씨|기온|온도|강수|풍속|예보|비\s*(?:가\s*)?(?:올|와|오겠)/.test(text)
  )
    return false;
  return (
    weatherWords.test(text) ||
    (temporalWords.test(text) && /(?:^|\s)(?:비|눈)(?:\s|[?？]|$)/.test(text))
  );
}

/** Only plain forecasts bypass the model; any additional topic remains a model request. */
export function isStandaloneWeatherRequest(request: ChatRequest): boolean {
  if (
    request.action.type !== 'message' ||
    !isWeatherQuestion(request.action.text)
  )
    return false;
  let remaining = request.action.text.replace(
    /(?:(?:기존|현재|내)|(?:방금|앞서|아까|이전에?|조금\s*전(?:에)?)\s*(?:만든|짠|생성한|구성한))?\s*(?:(?:\d+\s*박\s*)?\d+\s*일\s*)?(?:여행\s*)?일정(?:은|을|도)?\s*(?:그대로\s*(?:놔두고|두고|둔\s*채|둬|유지(?:해주세요|해줘|하고|해))?|유지(?:해주세요|해줘|하고|해)|(?:변경|수정)\s*없이|(?:바꾸|건드리|수정하|변경하)지\s*(?:말고|마(?:세요)?))/g,
    ' ',
  );
  if (
    /일정|코스|추천|교체|추가|삭제|넣어|빼줘|바꿔|만들|짜줘|생성|옷차림|복장|준비물|우천|대안|대체|어디|가볼|길찾기|지도/.test(
      remaining,
    )
  )
    return false;
  for (const location of locations)
    remaining = remaining.replace(
      new RegExp(`(?:${location.pattern.source})(?:에서|의|도|시|에)?`, 'g'),
      ' ',
    );
  remaining = remaining
    .replace(
      new RegExp(`(?:${unsupportedLocations.source})(?:에서|의|시|에)?`, 'g'),
      ' ',
    )
    .replace(
      /(?:\d{4}-\d{2}-\d{2}|\d+\s*(?:년|월|일)|[-+]?\d+(?:\.\d+)?\s*(?:°C|도|m\/s|mm|%))(?:부터|까지|동안|간|뒤|후)?/g,
      ' ',
    )
    .replace(
      /(?:강수확률|강수량|날씨|기온|온도|풍속|바람|강수|예보|비|눈)(?:이랑|하고|과|와|랑|의|은|는|이|가|을|를|에|도|만)?/g,
      ' ',
    )
    .replace(
      /(?:(?:이번|다음|지난)\s*(?:주말|주|달|해)|오늘|내일|모레|지금|현재|어제|그제|일주일|한\s*주(?:일)?|하루|이틀|사흘|나흘|닷새|엿새|이레|앞으로|아침|저녁|오전|오후|주말|한국\s*시간|KST)(?:부터|까지|동안|간|뒤|후|의|은|는|에|도|만)?/g,
      ' ',
    )
    .replace(
      /알려\s*(?:주세요|줘|줄래요?|주실래요|주실\s*수\s*있나요|주고)|확인\s*(?:해\s*주세요|해줘|부탁해요)|보여\s*(?:주세요|줘)|어때요?|어떤가요|어떻나요|어떻습니까|얼마야|얼마인가요|올까요|올까|오나요|오니|오나|와요?|불어요?|많이|세게|부탁합니다|부탁해요|궁금해요|혹시|그러면|그럼|좀/g,
      ' ',
    )
    .replace(
      /(?:^|\s)(?:이랑|하고|그리고|에서|부터|까지|동안|간|뒤|후|과|와|랑|및|의|은|는|이|가|을|를|에|도|만)(?=\s|$)/g,
      ' ',
    )
    .replace(/[\s.,!?？·:;~～()[\]{}'"-]/g, '');
  return remaining.length === 0;
}

function locationFor(text: string, region: string | null | undefined) {
  // Explicit unsupported locations always override the existing itinerary.
  const namedDistrict = text.match(
    /([가-힣]{2,12}(?:시|군|구|읍|면))\s*(?:의\s*)?(?:오늘|내일|모레|현재|지금|날씨|기온|온도|강수|바람)/,
  )?.[1];
  if (
    unsupportedLocations.test(text) ||
    (namedDistrict && !locations.some((l) => l.pattern.test(namedDistrict)))
  )
    return 'unsupported' as const;
  const matches = locations.filter((l) => l.pattern.test(text));
  if (
    matches.some((l) => l.name === '서울') &&
    matches.some((l) => l.name !== '서울')
  )
    return 'multiple' as const;
  // Unknown place names directly qualifying the forecast must not silently use
  // the current itinerary's coordinates (e.g. "청송 오늘 날씨" while in Jeju).
  if (!matches.length) {
    const prefix =
      text.match(/^(.*?)(?:날씨|기온|온도|강수|풍속|바람|예보)/)?.[1] ?? '';
    const remaining = prefix
      .replace(
        /\d{4}-\d{2}-\d{2}|(?:(?:\d{4})\s*년\s*)?\d+\s*월\s*\d+\s*일|\d+\s*(?:일|주|달|개월)\s*(?:뒤|후)|\d+\s*월|\d+\s*일\s*(?:간|동안)?/g,
        '',
      )
      .replace(
        /(?:이번|다음|지난)\s*(?:주말|주|달|해)|(?:일주일|한\s*주(?:일)?|하루|이틀|사흘|나흘|닷새|엿새|이레)\s*(?:간|동안)?|앞으로|부터|까지|어제|그제|내후년|내년|작년|오늘|내일|모레|현재|지금|주말|아침|저녁|오전|오후|혹시|그럼|그런데|여기|거기|이곳|그곳|여행지|여행\s*지역|우리|좀|대략적인|실시간|의|은|는|에서|에|어떻게/g,
        '',
      )
      .trim();
    if (/[가-힣A-Za-z]{2}/.test(remaining)) return 'unsupported' as const;
  }
  const match = matches[0] ?? locations.find((l) => l.name === region);
  return match
    ? {
        name: match.name,
        latitude: match.latitude,
        longitude: match.longitude,
        timezone: 'Asia/Seoul' as const,
      }
    : undefined;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const dayValue = (date: string) => Date.parse(date + 'T00:00:00Z');
function validDay(date: string) {
  const value = dayValue(date);
  return Number.isFinite(value) && isoDay(new Date(value)) === date;
}
const calendarDatePattern =
  '(?:\\d{4}-\\d{2}-\\d{2}|(?:(?:\\d{4})\\s*년\\s*)?\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일)';
function calendarDay(value: string, today: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return validDay(value) ? value : undefined;
  const match = value.match(
    /^(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일$/,
  );
  if (!match) return;
  const year =
    match[1] ??
    (today.slice(5, 7) === '12' && Number(match[2]) === 1
      ? String(Number(today.slice(0, 4)) + 1)
      : today.slice(0, 4));
  const date = `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return validDay(date) ? date : undefined;
}
function forecastDuration(text: string, today: string) {
  const units =
    '(\\d+\\s*일|하루|이틀|사흘|나흘|닷새|엿새|이레|일주일|한\\s*주(?:일)?)';
  const from = text.match(
    new RegExp(`(오늘|내일|모레|${calendarDatePattern})\\s*부터\\s*${units}`),
  );
  const forward = text.match(new RegExp(`(앞으로)\\s*${units}`));
  // A bare trip duration such as "2박 3일 일정" is not a dated forecast range.
  const lasting = text.match(new RegExp(`${units}\\s*(?:간|동안)`));
  const week = text.match(/일주일|한\s*주(?:일)?\s*(?:간|동안)/);
  const value = from?.[2] ?? forward?.[2] ?? lasting?.[1] ?? week?.[0];
  if (!value) return;
  const normalized = value.replace(/\s|간|동안/g, '');
  const nativeDays: Record<string, number> = {
    하루: 1,
    이틀: 2,
    사흘: 3,
    나흘: 4,
    닷새: 5,
    엿새: 6,
    이레: 7,
    일주일: 7,
    한주: 7,
    한주일: 7,
  };
  return {
    startOffset:
      from?.[1] === '내일'
        ? 1
        : from?.[1] === '모레'
          ? 2
          : from && from[1] !== '오늘'
            ? (dayValue(calendarDay(from[1], today) ?? '') - dayValue(today)) /
              DAY
            : 0,
    days: nativeDays[normalized] ?? Number(normalized.replace(/일$/, '')),
  };
}
function datesFor(text: string, today: string): string[] | undefined {
  if (/(?:한|두|세|네)\s*(?:달|개월|주|년)\s*(?:뒤|후)/.test(text)) return;
  if (
    /(?:뒤|후)/.test(text.replaceAll('오후', '')) &&
    !/\d+\s*일\s*(?:뒤|후)/.test(text)
  )
    return;
  const base = dayValue(today);
  const dates = new Set<string>();
  const add = (offset: number) =>
    dates.add(isoDay(new Date(base + offset * DAY)));
  if (
    /어제|그제|지난\s*(?:주|달|해)|작년|다음\s*(?:주|달)|내년|내후년|일주일\s*(?:후|뒤)|\d+\s*(?:주|달|개월)\s*(?:후|뒤)/.test(
      text,
    )
  )
    return;
  for (const [date] of text.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
    if (!validDay(date)) return;
    dates.add(date);
  }
  for (const match of text.matchAll(
    /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g,
  )) {
    const date = calendarDay(match[0], today);
    if (!date) return;
    dates.add(date);
  }
  if (/\d+\s*월/.test(text) && !/\d+\s*월\s*\d+\s*일/.test(text)) return;
  for (const match of text.matchAll(/(\d+)\s*일\s*(?:후|뒤)/g)) {
    if (Number(match[1]) > 6) return;
    add(Number(match[1]));
  }
  const range = text.match(
    new RegExp(
      `(오늘|내일|모레|${calendarDatePattern})\\s*부터\\s*(오늘|내일|모레|${calendarDatePattern}|\\d{1,2}\\s*일)\\s*까지`,
    ),
  );
  if (range) {
    const relative: Record<string, number> = { 오늘: 0, 내일: 1, 모레: 2 };
    const start = Object.hasOwn(relative, range[1])
      ? isoDay(new Date(base + relative[range[1]] * DAY))
      : calendarDay(range[1], today);
    const shortEnd = range[2].match(/^(\d{1,2})\s*일$/);
    const end = Object.hasOwn(relative, range[2])
      ? isoDay(new Date(base + relative[range[2]] * DAY))
      : shortEnd && start
        ? `${start.slice(0, 7)}-${shortEnd[1].padStart(2, '0')}`
        : calendarDay(range[2], today);
    if (!start || !end || !validDay(end)) return;
    const first = (dayValue(start) - base) / DAY,
      last = (dayValue(end) - base) / DAY;
    if (first < 0 || last > 6 || first > last) return;
    for (let i = first; i <= last; i++) add(i);
  }
  const duration = range ? undefined : forecastDuration(text, today);
  if (duration) {
    if (
      !Number.isInteger(duration.startOffset) ||
      duration.startOffset < 0 ||
      !Number.isInteger(duration.days) ||
      duration.days < 1 ||
      duration.days > 7
    )
      return;
    for (let i = 0; i < duration.days; i++) add(duration.startOffset + i);
  }
  if (/오늘|지금|현재/.test(text)) add(0);
  if (/내일/.test(text)) add(1);
  if (/모레/.test(text)) add(2);
  const weekday = new Date(base).getUTCDay();
  const untilSunday = (7 - weekday) % 7;
  if (/주말/.test(text)) {
    if (weekday === 0) add(0);
    else {
      add(untilSunday - 1);
      add(untilSunday);
    }
  } else if (/이번\s*주/.test(text)) {
    for (let i = 0; i <= untilSunday; i++) add(i);
  }
  if (!dates.size) add(0);
  const result = [...dates].sort();
  if (
    result.some(
      (d) => (dayValue(d) - base) / DAY < 0 || (dayValue(d) - base) / DAY > 6,
    )
  )
    return;
  return result;
}

const codes: Record<number, string> = {
  0: '맑음',
  1: '대체로 맑음',
  2: '구름 조금',
  3: '흐림',
  45: '안개',
  48: '착빙 안개',
  51: '약한 이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  56: '약한 어는 이슬비',
  57: '강한 어는 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  66: '약한 어는 비',
  67: '강한 어는 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  77: '싸락눈',
  80: '약한 소나기',
  81: '소나기',
  82: '강한 소나기',
  85: '약한 눈 소나기',
  86: '강한 눈 소나기',
  95: '뇌우',
  96: '우박을 동반한 뇌우',
  99: '강한 우박을 동반한 뇌우',
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_WEATHER');
  return value as Record<string, unknown>;
};
function number(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error('INVALID_WEATHER');
  return value;
}
function condition(value: unknown) {
  if (typeof value !== 'number' || !Object.hasOwn(codes, value))
    throw new Error('INVALID_WEATHER');
  return codes[value];
}

function koreanTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp + 9 * 3_600_000)
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ')
    : undefined;
}

/** Render only validated weather facts so a model cannot change numeric units. */
export function formatWeatherAnswer(context: WeatherChatContext): string {
  const supported = '제주(서귀포·성산·한림·협재·애월·함덕) 또는 서울';
  if (context.status === 'asked-location')
    return `어느 지역의 날씨를 확인할까요? ${supported} 중 한 곳을 알려주세요.`;
  if (context.status === 'unsupported-location')
    return `지금은 ${supported}의 날씨를 조회할 수 있어요. 요청하신 지역의 현재 날씨와 예보는 조회하지 못했어요.`;
  const retrievedAt = koreanTimestamp(context.retrievedAt);
  const today = retrievedAt?.slice(0, 10);
  if (context.status === 'unsupported-date')
    return today
      ? `예보는 한국 시간 ${today}부터 ${isoDay(new Date(dayValue(today) + 6 * DAY))}까지, 오늘을 포함한 7일간 조회할 수 있어요. 요청하신 기간은 조회하지 않았어요. 이 범위 안의 날짜를 알려주세요.`
      : '예보는 한국 시간 오늘부터 7일간 조회할 수 있어요. 요청하신 기간은 조회하지 않았어요. 이 범위 안의 날짜를 알려주세요.';
  const unavailable =
    '날씨 제공처에 연결하거나 응답을 확인하지 못해 현재 날씨와 예보를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.';
  if (context.status !== 'ready') return unavailable;
  try {
    const { location, dates, facts } = context;
    if (
      !retrievedAt ||
      !today ||
      !location ||
      context.source !== 'Open-Meteo' ||
      location.timezone !== 'Asia/Seoul' ||
      !locations.some((item) => item.name === location.name) ||
      !dates?.length ||
      dates.length > 7 ||
      new Set(dates).size !== dates.length ||
      dates.some(
        (date) =>
          !validDay(date) ||
          (dayValue(date) - dayValue(today)) / DAY < 0 ||
          (dayValue(date) - dayValue(today)) / DAY > 6,
      ) ||
      !facts?.daily.length
    )
      return unavailable;
    const knownCondition = (value: string) => {
      if (!Object.values(codes).includes(value))
        throw new Error('INVALID_WEATHER');
      return value;
    };
    const lines = [
      `${location.name} 날씨예요.`,
      `조회 시각: ${retrievedAt} (한국 시간).`,
    ];
    const current = facts.current;
    if (dates.includes(today) && current?.time.startsWith(today)) {
      const currentTime = koreanTimestamp(current.time);
      const ageMs = Date.parse(context.retrievedAt) - Date.parse(current.time);
      if (
        !currentTime ||
        !Number.isFinite(ageMs) ||
        ageMs > 90 * 60_000 ||
        ageMs < -30 * 60_000
      )
        throw new Error('STALE_WEATHER');
      lines.push(
        `현재 상태(모델 기준 ${currentTime}, 한국 시간): ${knownCondition(current.condition)}, 기온 ${number(current.temperatureC, -100, 70)}°C, 강수량 ${number(current.precipitationMm, 0, 1000)}mm, 풍속 ${number(current.windSpeedMs, 0, 150)}m/s.`,
      );
    }
    for (const date of dates) {
      const daily = facts.daily.find((item) => item.date === date);
      if (!daily) throw new Error('MISSING_WEATHER_DATE');
      const min = number(daily.minTemperatureC, -100, 70),
        max = number(daily.maxTemperatureC, -100, 70);
      if (min > max) throw new Error('INVALID_WEATHER');
      lines.push(
        `${date} 예보: ${knownCondition(daily.condition)}, 최저 ${min}°C / 최고 ${max}°C, 최대 강수확률 ${number(daily.maxPrecipitationProbability, 0, 100)}%, 최대 풍속 ${number(daily.maxWindSpeedMs, 0, 150)}m/s.`,
      );
    }
    lines.push(
      'Open-Meteo의 모델 기반 자료예요. 현재 상태는 관측소 실측이 아니며, 강수확률은 비가 반드시 온다는 뜻은 아니에요.',
    );
    return lines.join('\n');
  } catch {
    return unavailable;
  }
}
function factsFor(value: unknown, dates: string[], today: string, now: Date) {
  const data = object(value);
  if (data.timezone !== 'Asia/Seoul' || data.utc_offset_seconds !== 32400)
    throw new Error('INVALID_WEATHER');
  const daily = object(data.daily),
    units = object(data.daily_units);
  for (const [key, unit] of Object.entries({
    temperature_2m_min: '°C',
    temperature_2m_max: '°C',
    precipitation_probability_max: '%',
    wind_speed_10m_max: 'm/s',
  })) {
    if (units[key] !== unit) throw new Error('INVALID_WEATHER_UNITS');
  }
  const times = daily.time;
  if (
    !Array.isArray(times) ||
    !times.length ||
    times.length > 7 ||
    new Set(times).size !== times.length ||
    times.some((d) => typeof d !== 'string' || !validDay(d))
  )
    throw new Error('INVALID_WEATHER');
  const field = (key: string, i: number) => {
    const list = daily[key];
    if (!Array.isArray(list) || list.length !== times.length)
      throw new Error('INVALID_WEATHER');
    return list[i];
  };
  const result: NonNullable<WeatherChatContext['facts']> = {
    daily: dates.map((date) => {
      const i = times.indexOf(date);
      if (i < 0) throw new Error('MISSING_WEATHER_DATE');
      const minTemperatureC = number(field('temperature_2m_min', i), -100, 70);
      const maxTemperatureC = number(field('temperature_2m_max', i), -100, 70);
      if (minTemperatureC > maxTemperatureC) throw new Error('INVALID_WEATHER');
      return {
        date,
        minTemperatureC,
        maxTemperatureC,
        maxPrecipitationProbability: number(
          field('precipitation_probability_max', i),
          0,
          100,
        ),
        maxWindSpeedMs: number(field('wind_speed_10m_max', i), 0, 150),
        condition: condition(field('weather_code', i)),
      };
    }),
  };
  if (dates.includes(today)) {
    const current = object(data.current),
      currentUnits = object(data.current_units);
    if (
      currentUnits.temperature_2m !== '°C' ||
      currentUnits.precipitation !== 'mm' ||
      currentUnits.wind_speed_10m !== 'm/s'
    )
      throw new Error('INVALID_WEATHER_UNITS');
    if (
      typeof current.time !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(current.time) ||
      !current.time.startsWith(today)
    )
      throw new Error('STALE_WEATHER');
    const ageMs = now.getTime() - Date.parse(current.time + '+09:00');
    if (!Number.isFinite(ageMs) || ageMs > 90 * 60_000 || ageMs < -30 * 60_000)
      throw new Error('STALE_WEATHER');
    result.current = {
      time: current.time + '+09:00',
      temperatureC: number(current.temperature_2m, -100, 70),
      precipitationMm: number(current.precipitation, 0, 1000),
      windSpeedMs: number(current.wind_speed_10m, 0, 150),
      condition: condition(current.weather_code),
    };
  }
  return result;
}

async function boundedJson(response: Response) {
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('application/json') ||
    !response.body ||
    Number(response.headers.get('content-length') ?? 0) > MAX_BYTES
  )
    throw new Error('WEATHER_UNAVAILABLE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('WEATHER_TOO_LARGE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } finally {
    void reader.cancel().catch(() => {});
  }
}

/** Server-only lookup; user text and user-supplied URLs/coordinates are never forwarded. */
export async function weatherContextForChat(
  request: ChatRequest,
  fetcher: typeof fetch = fetch,
  options: { now?: Date } = {},
): Promise<WeatherChatContext | undefined> {
  if (
    request.action.type !== 'message' ||
    !isWeatherQuestion(request.action.text)
  )
    return;
  const now = options.now ?? new Date();
  const base = { ...SOURCE, retrievedAt: now.toISOString() };
  const text = request.action.text;
  const location = locationFor(
    text,
    request.session.turns.at(-1)?.state.region,
  );
  if (location === 'unsupported')
    return {
      ...base,
      status: 'unsupported-location',
      instruction:
        '지금 날씨 조회는 제주(서귀포·성산·한림·협재·애월·함덕)와 서울만 지원한다. 요청한 다른 지역을 제주나 기존 여행 지역으로 바꿔 답하지 말고 지원 지역을 안내하라. 실시간 날씨 수치를 만들지 마라.',
    };
  if (!location || location === 'multiple')
    return {
      ...base,
      status: 'asked-location',
      instruction:
        '날씨를 확인할 지역을 한 곳 물어라. 제주(서귀포·성산·한림·협재·애월·함덕) 또는 서울을 고를 수 있다. 지역을 임의로 정하거나 날씨 수치를 만들지 마라.',
    };
  const today = isoDay(new Date(now.getTime() + 9 * 3_600_000));
  const dates = datesFor(text, today);
  if (!dates)
    return {
      ...base,
      location,
      status: 'unsupported-date',
      instruction: `조회 가능한 예보는 한국 시간 ${today}부터 ${isoDay(new Date(dayValue(today) + 6 * DAY))}까지(오늘을 포함한 7일)이다. 과거 또는 범위 밖 날짜를 조회하지 않았다. 시작일과 종료일을 그대로 안내하고 요청 날짜를 오늘로 바꾸지 말라. 날씨 수치를 만들지 마라.`,
    };
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  for (const [key, value] of Object.entries({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: 'Asia/Seoul',
    forecast_days: '7',
    temperature_unit: 'celsius',
    wind_speed_unit: 'ms',
    precipitation_unit: 'mm',
    current: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max',
  }))
    url.searchParams.set(key, value);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      fetcher(url.toString(), {
        headers: { Accept: 'application/json' },
        redirect: 'manual',
        signal: controller.signal,
      }).then(boundedJson),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('WEATHER_TIMEOUT'));
        }, WEATHER_TIMEOUT_MS);
      }),
    ]);
    const facts = factsFor(value, dates, today, now);
    return {
      ...base,
      status: 'ready',
      location,
      dates,
      facts,
      instruction:
        '날씨는 이 도구 결과만 사용하고 Open-Meteo와 한국 시간의 조회 시각·대상 날짜를 함께 밝혀라. current는 기상 관측 실측이 아닌 모델 기반 현재 상태이고 daily는 예보다. current.time은 자료 기준 시각이며 현재 시계 시각이 아니다. retrievedAt은 조회 시각이다. 자연스러운 한국어로 수치와 단위를 유지하고 강수확률을 비가 반드시 온다는 뜻으로 단정하지 마라. 요청하지 않은 여행 일정을 변경하지 마라.',
    };
  } catch {
    return {
      ...base,
      status: 'unavailable',
      location,
      dates,
      instruction:
        '날씨 제공처에 연결하거나 응답을 검증하지 못해 현재 날씨·예보를 확인하지 못했다. 확인 실패를 짧게 알리고 수치·맑음·강수 여부를 추측하지 마라. 일반 여행 정보는 답할 수 있지만 현재 날씨와 구분하라. 요청하지 않은 여행 일정을 변경하지 마라.',
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    controller.abort();
  }
}
