import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatWeatherAnswer,
  isStandaloneWeatherRequest,
  weatherContextForChat,
} from '../lib/weather-tool.ts';

const now = new Date('2026-10-14T16:00:00Z'); // 2026-10-15 01:00 KST
const options = { now };
const request = (text, region = null) => ({
  action: { type: 'message', text },
  session: { turns: [{ state: { region } }] },
});
const fixture = () => ({
  timezone: 'Asia/Seoul',
  utc_offset_seconds: 32400,
  current_units: {
    temperature_2m: '°C',
    precipitation: 'mm',
    wind_speed_10m: 'm/s',
  },
  current: {
    time: '2026-10-15T01:00',
    temperature_2m: 18.5,
    precipitation: 0,
    wind_speed_10m: 3.2,
    weather_code: 2,
  },
  daily_units: {
    temperature_2m_min: '°C',
    temperature_2m_max: '°C',
    precipitation_probability_max: '%',
    wind_speed_10m_max: 'm/s',
  },
  daily: {
    time: Array.from({ length: 7 }, (_, i) => `2026-10-${15 + i}`),
    temperature_2m_min: [17, 18, 19, 20, 18, 17, 17],
    temperature_2m_max: [24, 25, 25, 26, 24, 23, 24],
    precipitation_probability_max: [0, 10, 20, 30, 40, 50, 60],
    wind_speed_10m_max: [3, 4, 5, 6, 7, 8, 9],
    weather_code: [0, 1, 2, 3, 61, 63, 65],
  },
});
const ok = async () => Response.json(fixture());
const noFetch = () => {
  throw new Error('must not fetch');
};

test('standalone forecast detection keeps travel and other simultaneous questions on the model path', () => {
  for (const text of [
    '제주 오늘 날씨 알려줘',
    '오늘 날씨 어때?',
    '제주도 내일 기온과 풍속 알려주세요',
    '오늘부터 3일간 날씨 알려줘',
    '제주 내일 비 와?',
    '부산 오늘 날씨 알려줘',
    '한라산 오늘 날씨',
    '기존 일정은 그대로 두고 오늘 제주 날씨만 알려줘',
    '날씨 알려줘. 일정은 변경하지 마세요.',
    '현재 여행 일정은 바꾸지 말고 제주 내일 날씨만 알려줘',
    '오늘부터 3일간 제주 날씨 알려줘. 기존 일정은 그대로 유지해.',
    '제주도 오늘 날씨 어때? 기온, 강수확률, 바람을 알려줘. 기존 2박 3일 일정은 그대로 유지해.',
    '제주도 오늘부터 3일 날씨도 알려줘. 방금 만든 일정은 그대로 유지해줘.',
    '제주도 오늘부터 3일 날씨도 알려줘. 방금 짠 일정은 그대로 유지해줘.',
    '앞서 만든 일정은 그대로 두고 제주 오늘부터 3일 날씨도 알려줘.',
    '아까 생성한 여행 일정은 그대로 유지해줘. 제주 내일 날씨 알려줘.',
    '조금 전에 구성한 일정은 그대로 두고 제주 오늘 날씨 알려줘.',
  ])
    assert.equal(isStandaloneWeatherRequest(request(text)), true, text);
  for (const text of [
    '제주 2박 3일 일정이랑 날씨 알려줘',
    '제주 오늘 날씨 알려주고 일정을 만들어줘',
    '오늘 날씨와 비 오는 날 갈 만한 곳 추천해줘',
    '오늘 제주 날씨 보고 DAY 2 실내 관광지로 교체해줘',
    '오늘 제주 날씨랑 일정에 아쿠아플라넷 추가해줘',
    '오늘 날씨와 옷차림 알려줘',
    '제주도 오늘부터 3일 날씨도 알려줘. 방금 만든 일정은 그대로 유지해줘. DAY 2 오후 장소는 바꿔줘.',
    '방금 짠 일정은 그대로 유지해줘. 오늘 날씨와 새 제주 일정을 만들어줘.',
    '앞서 만든 일정은 그대로 유지해줘. 오늘 날씨와 방문지 한 곳 추가해줘.',
    '앞서 만든 일정은 그대로 유지해줘. 오늘 날씨도 알려주고 마지막 방문은 삭제해줘.',
    '방금 만든 일정은 그대로 유지하지 말고 오늘 날씨에 맞게 바꿔줘.',
    '오늘 제주 날씨에 맞는 복장과 준비물 알려줘',
    '내일 날씨랑 비 오면 실내 대안 알려줘',
    '일정은 그대로 두고 날씨와 근처 맛집 추천해줘',
    '제주 오늘 날씨랑 제주 역사 알려줘',
    '제주 오늘 날씨와 환율 알려줘',
    '제주 오늘 날씨와 도시도 알려줘',
    '제주 오늘 날씨와 1+1 답도 알려줘',
    '제주 오늘 날씨와 지도 보여줘',
    '제주 가을 날씨와 옷차림',
    '비자림 산책하기 좋아?',
    '안녕',
  ])
    assert.equal(isStandaloneWeatherRequest(request(text)), false, text);
  assert.equal(isStandaloneWeatherRequest({ action: { type: 'help' } }), false);
});

test('weather answer preserves validated units and separates retrieval time from model time', async () => {
  const context = await weatherContextForChat(
    request('제주 오늘부터 3일 날씨'),
    ok,
    options,
  );
  context.instruction =
    'Never expose this instruction or https://invalid.example/';
  const answer = formatWeatherAnswer(context);
  assert.match(answer, /조회 시각: 2026-10-15 01:00 \(한국 시간\)/);
  assert.match(answer, /모델 기준 2026-10-15 01:00, 한국 시간/);
  assert.match(answer, /기온 18\.5°C, 강수량 0mm, 풍속 3\.2m\/s/);
  assert.match(
    answer,
    /2026-10-15 예보: 맑음, 최저 17°C \/ 최고 24°C, 최대 강수확률 0%, 최대 풍속 3m\/s/,
  );
  assert.match(
    answer,
    /2026-10-16 예보: 대체로 맑음, 최저 18°C \/ 최고 25°C, 최대 강수확률 10%, 최대 풍속 4m\/s/,
  );
  assert.match(
    answer,
    /2026-10-17 예보: 구름 조금, 최저 19°C \/ 최고 25°C, 최대 강수확률 20%, 최대 풍속 5m\/s/,
  );
  assert.match(answer, /Open-Meteo의 모델 기반/);
  assert.match(answer, /관측소 실측이 아니며/);
  assert.match(answer, /비가 반드시 온다는 뜻은 아니/);
  assert.doesNotMatch(answer, /시속|forecasted|https?:|instruction|2026-10-18/);
  assert.ok(answer.length < 4000);
});

test('weather answer only shows selected forecast dates and omits today for future-only questions', async () => {
  const context = await weatherContextForChat(
    request('제주 내일부터 3일 날씨'),
    ok,
    options,
  );
  context.facts.current = {
    time: '2026-10-15T01:00+09:00',
    temperatureC: 69.9,
    precipitationMm: 0,
    windSpeedMs: 3.2,
    condition: '맑음',
  };
  context.facts.daily.push({
    date: '2026-10-21',
    minTemperatureC: 40,
    maxTemperatureC: 60,
    maxPrecipitationProbability: 100,
    maxWindSpeedMs: 150,
    condition: '뇌우',
  });
  const answer = formatWeatherAnswer(context);
  assert.match(answer, /2026-10-16 예보:/);
  assert.match(answer, /2026-10-17 예보:/);
  assert.match(answer, /2026-10-18 예보:/);
  assert.doesNotMatch(
    answer,
    /현재 상태\(|69\.9|2026-10-15 예보|2026-10-21|최대 풍속 150/,
  );
});

test('weather answer gives precise nonready guidance and never renders unconfirmed facts', async () => {
  for (const [text, expected] of [
    ['오늘 날씨', /어느 지역의 날씨/],
    ['부산 오늘 날씨', /요청하신 지역의 현재 날씨와 예보는 조회하지 못/],
    ['제주 내일부터 일주일 날씨', /2026-10-15부터 2026-10-21까지/],
  ]) {
    const context = await weatherContextForChat(
      request(text),
      noFetch,
      options,
    );
    context.facts = { daily: [{ date: '2026-10-15', maxTemperatureC: 69.9 }] };
    const answer = formatWeatherAnswer(context);
    assert.match(answer, expected, text);
    assert.doesNotMatch(answer, /69\.9|°C|m\/s|맑음|https?:/, text);
  }
  const unavailable = await weatherContextForChat(
    request('제주 오늘 날씨'),
    noFetch,
    options,
  );
  assert.match(
    formatWeatherAnswer(unavailable),
    /현재 날씨와 예보를 확인할 수 없어요/,
  );
});

test('weather answer rejects incomplete or invalid ready facts instead of showing partial numbers', async () => {
  const context = await weatherContextForChat(
    request('제주 오늘부터 3일 날씨'),
    ok,
    options,
  );
  for (const mutate of [
    (value) => {
      value.facts.daily.pop();
    },
    (value) => {
      value.facts.daily[1].maxPrecipitationProbability = 101;
    },
    (value) => {
      value.facts.current.windSpeedMs = NaN;
    },
    (value) => {
      value.facts.daily[0].condition = 'https://invalid.example/';
    },
  ]) {
    const invalid = structuredClone(context);
    mutate(invalid);
    const answer = formatWeatherAnswer(invalid);
    assert.match(answer, /현재 날씨와 예보를 확인할 수 없어요/);
    assert.doesNotMatch(answer, /18\.5|°C|m\/s|https?:/);
  }
  const week = await weatherContextForChat(
    request('제주 오늘부터 일주일 날씨'),
    ok,
    options,
  );
  assert.ok(formatWeatherAnswer(week).length < 4000);
});

test('weather tool leaves ordinary travel, conditional rain and clothing questions to chat', async () => {
  for (const text of [
    '비자림 산책하기 좋아?',
    '제주 비 오는 날 여행 코스',
    '내일 비가 오면 어디 가지?',
    '제주 가을 날씨와 옷차림',
    '제주 옷차림 알려줘',
    '제주 계절별 준비물',
    '서울숲 특징 알려줘',
  ]) {
    assert.equal(
      await weatherContextForChat(request(text), noFetch, options),
      undefined,
      text,
    );
  }
  assert.equal(
    await weatherContextForChat({ action: { type: 'help' } }, noFetch, options),
    undefined,
  );
});

test('weather requires a known location and never assumes Jeju for other named regions', async () => {
  assert.equal(
    (await weatherContextForChat(request('오늘 날씨 어때?'), noFetch, options))
      .status,
    'asked-location',
  );
  for (const text of [
    '부산 날씨 알려줘',
    '도쿄 내일 기온은?',
    '수원시 오늘 날씨',
    '청송 오늘 날씨',
    'London 내일 기온',
    '한라산 오늘 날씨',
    '제주 백록담 날씨',
    '우도 오늘 바람',
  ]) {
    const result = await weatherContextForChat(
      request(text, '제주'),
      noFetch,
      options,
    );
    assert.equal(result.status, 'unsupported-location', text);
    assert.equal(result.location, undefined);
  }
  assert.equal(
    (
      await weatherContextForChat(
        request('서울과 제주 오늘 날씨 비교'),
        noFetch,
        options,
      )
    ).status,
    'asked-location',
  );
});

test('weather fetch uses only fixed endpoint and public coordinates, with validated KST facts', async () => {
  let calls = 0;
  const result = await weatherContextForChat(
    request('제주 오늘 날씨 알려줘'),
    async (input, init) => {
      calls++;
      const url = new URL(input);
      assert.equal(
        url.origin + url.pathname,
        'https://api.open-meteo.com/v1/forecast',
      );
      assert.equal(url.searchParams.get('latitude'), '33.4996');
      assert.equal(url.searchParams.get('longitude'), '126.5312');
      assert.equal(url.searchParams.get('timezone'), 'Asia/Seoul');
      assert.equal(url.searchParams.get('wind_speed_unit'), 'ms');
      assert.equal(url.searchParams.get('forecast_days'), '7');
      assert.equal(init.redirect, 'manual');
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(init.body, undefined);
      assert.ok(!String(input).includes('알려줘'));
      return Response.json(fixture());
    },
    options,
  );
  assert.equal(calls, 1);
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'Open-Meteo');
  assert.equal(result.sourceUrl, 'https://open-meteo.com/');
  assert.equal(result.retrievedAt, now.toISOString());
  assert.deepEqual(result.dates, ['2026-10-15']);
  assert.equal(result.facts.current.time, '2026-10-15T01:00+09:00');
  assert.equal(result.facts.current.temperatureC, 18.5);
  assert.equal(result.facts.daily[0].maxPrecipitationProbability, 0);
  assert.match(result.instruction, /모델 기반/);
});

test('weather resolves detailed Jeju locations before island default and inherits current region', async () => {
  const expected = [
    ['제주 서귀포', '서귀포'],
    ['성산', '성산'],
    ['협재', '협재'],
    ['한림', '한림'],
    ['애월', '애월'],
    ['함덕', '함덕'],
    ['서울숲', '서울'],
  ];
  for (const [name, resolved] of expected) {
    const result = await weatherContextForChat(
      request(`${name} 내일 기온`),
      ok,
      options,
    );
    assert.equal(result.status, 'ready', name);
    assert.equal(result.location.name, resolved, name);
    assert.deepEqual(result.dates, ['2026-10-16']);
    assert.equal(result.facts.current, undefined);
  }
  const result = await weatherContextForChat(
    request('오늘 날씨 어때?', '제주'),
    ok,
    options,
  );
  assert.equal(result.location.name, '제주');
});

test('weather date selection preserves tomorrow, explicit dates, this week and weekend', async () => {
  for (const [text, dates] of [
    ['제주 모레 날씨', ['2026-10-17']],
    ['제주 2026-10-20 기온', ['2026-10-20']],
    ['제주 10월 21일 기온', ['2026-10-21']],
    ['제주 6일 뒤 강수확률', ['2026-10-21']],
    ['제주 이번 주말 날씨', ['2026-10-17', '2026-10-18']],
    [
      '제주 이번주 날씨',
      ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
    ],
  ]) {
    const result = await weatherContextForChat(request(text), ok, options);
    assert.equal(result.status, 'ready', text);
    assert.deepEqual(result.dates, dates, text);
    assert.deepEqual(
      result.facts.daily.map((d) => d.date),
      dates,
    );
  }
});

test('weather expands explicit forecast durations without treating trip length as forecast dates', async () => {
  for (const [text, dates] of [
    ['제주 오늘부터 3일 날씨', ['2026-10-15', '2026-10-16', '2026-10-17']],
    ['제주 내일부터 3일간 날씨', ['2026-10-16', '2026-10-17', '2026-10-18']],
    ['제주 모레부터 이틀 날씨', ['2026-10-17', '2026-10-18']],
    ['제주 앞으로 사흘 날씨', ['2026-10-15', '2026-10-16', '2026-10-17']],
    ['제주 3일간 날씨', ['2026-10-15', '2026-10-16', '2026-10-17']],
    [
      '제주 10월 16일부터 3일간 날씨',
      ['2026-10-16', '2026-10-17', '2026-10-18'],
    ],
    [
      '제주 2026-10-19부터 3일 날씨',
      ['2026-10-19', '2026-10-20', '2026-10-21'],
    ],
    ['제주 오늘부터 모레까지 날씨', ['2026-10-15', '2026-10-16', '2026-10-17']],
    [
      '제주 10월 16일부터 18일까지 날씨',
      ['2026-10-16', '2026-10-17', '2026-10-18'],
    ],
    [
      '제주 10월 16일부터 10월 18일까지 날씨',
      ['2026-10-16', '2026-10-17', '2026-10-18'],
    ],
    ['제주 2박 3일 일정이랑 날씨', ['2026-10-15']],
    ['제주 3일 뒤 날씨', ['2026-10-18']],
    [
      '제주 오늘부터 일주일 날씨',
      Array.from({ length: 7 }, (_, i) => `2026-10-${15 + i}`),
    ],
    [
      '제주 일주일 날씨',
      Array.from({ length: 7 }, (_, i) => `2026-10-${15 + i}`),
    ],
  ]) {
    const result = await weatherContextForChat(request(text), ok, options);
    assert.equal(result.status, 'ready', text);
    assert.deepEqual(result.dates, dates, text);
    assert.deepEqual(
      result.facts.daily.map((day) => day.date),
      dates,
      text,
    );
    assert.equal(!!result.facts.current, dates.includes('2026-10-15'), text);
  }
  for (const text of [
    '오늘부터 3일간 날씨',
    '내일부터 사흘간 날씨',
    '앞으로 일주일 날씨',
  ]) {
    const result = await weatherContextForChat(
      request(text, '제주'),
      ok,
      options,
    );
    assert.equal(result.status, 'ready', text);
    assert.equal(result.location.name, '제주', text);
    assert.equal(result.dates.length, text.includes('일주일') ? 7 : 3, text);
  }
});

test('weather rejects the whole forecast duration when it extends past the supported window', async () => {
  for (const text of [
    '제주 내일부터 일주일 날씨',
    '제주 모레부터 6일 날씨',
    '제주 오늘부터 8일 날씨',
    '제주 앞으로 30일 날씨',
    '제주 8일간 날씨',
    '제주 오늘부터 0일 날씨',
    '제주 2026-10-22부터 3일간 날씨',
    '제주 10월 20일부터 3일간 날씨',
    '제주 10월 18일부터 16일까지 날씨',
    '제주 10월 16일부터 22일까지 날씨',
  ]) {
    let calls = 0;
    const result = await weatherContextForChat(
      request(text),
      () => {
        calls++;
        return ok();
      },
      options,
    );
    assert.equal(result.status, 'unsupported-date', text);
    assert.equal(result.facts, undefined, text);
    assert.equal(calls, 0, text);
    assert.match(result.instruction, /2026-10-15부터 2026-10-21까지/, text);
  }
});

test('weather never substitutes today for past, invalid or unsupported future dates', async () => {
  for (const text of [
    '제주 어제 날씨',
    '제주 지난주 기온',
    '제주 다음주 날씨',
    '제주 다음달 날씨',
    '제주 한 달 뒤 날씨 예보 알려줘',
    '제주 보름 뒤 날씨',
    '제주 7일 뒤 날씨',
    '제주 2주 뒤 날씨',
    '제주 2026-10-22 날씨',
    '제주 10월 14일 날씨',
    '제주 2026-02-30 날씨',
    '제주 10월 날씨',
  ]) {
    const result = await weatherContextForChat(request(text), noFetch, options);
    assert.equal(result.status, 'unsupported-date', text);
    assert.equal(result.facts, undefined);
    assert.match(result.instruction, /오늘로 바꾸지/);
  }
  for (const text of ['내일 날씨', '다음주 날씨', '2주 뒤 기온', '어제 날씨']) {
    const result = await weatherContextForChat(
      request(text, '제주'),
      ok,
      options,
    );
    assert.equal(
      result.status,
      text.startsWith('내일') ? 'ready' : 'unsupported-date',
      text,
    );
  }
});

test('weather treats provider errors and redirects as unavailable without leaking upstream details', async () => {
  for (const fetcher of [
    async () => {
      throw new Error('private proxy detail');
    },
    async () => new Response('private upstream', { status: 403 }),
    async () =>
      new Response('', {
        status: 302,
        headers: { location: 'http://localhost/private' },
      }),
    async () =>
      new Response('<html>error</html>', {
        headers: { 'content-type': 'text/html' },
      }),
    async () =>
      new Response('{bad json', {
        headers: { 'content-type': 'application/json' },
      }),
  ]) {
    const result = await weatherContextForChat(
      request('제주 오늘 날씨'),
      fetcher,
      options,
    );
    assert.equal(result.status, 'unavailable');
    assert.equal(result.facts, undefined);
    assert.ok(!JSON.stringify(result).includes('private'));
    assert.match(result.instruction, /추측하지/);
  }
});

test('weather rejects stale, unit-mismatched, incomplete and implausible provider facts', async () => {
  for (const mutate of [
    (data) => {
      data.current.time = '2026-10-14T23:45';
    },
    (data) => {
      data.current.time = '2026-10-15T03:00';
    },
    (data) => {
      data.daily_units.wind_speed_10m_max = 'km/h';
    },
    (data) => {
      data.daily.precipitation_probability_max[0] = 101;
    },
    (data) => {
      data.current.temperature_2m = null;
    },
    (data) => {
      data.daily.temperature_2m_min[0] = 30;
    },
    (data) => {
      data.daily.weather_code[0] = 999;
    },
    (data) => {
      data.daily.time = data.daily.time.slice(1);
    },
    (data) => {
      data.utc_offset_seconds = 0;
    },
  ]) {
    const data = fixture();
    mutate(data);
    const result = await weatherContextForChat(
      request('제주 오늘 날씨'),
      async () => Response.json(data),
      options,
    );
    assert.equal(result.status, 'unavailable');
    assert.equal(result.facts, undefined);
  }
});

test('weather bounds streamed response bytes even without content-length', async () => {
  const result = await weatherContextForChat(
    request('제주 오늘 날씨'),
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(40_000));
            controller.close();
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    options,
  );
  assert.equal(result.status, 'unavailable');
});

test('weather accepts a validated provider response taking more than five seconds', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = weatherContextForChat(
    request('제주 오늘 날씨'),
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(Response.json(fixture())), 9000),
      ),
    options,
  );
  t.mock.timers.tick(9000);
  const result = await pending;
  assert.equal(result.status, 'ready');
  assert.equal(result.facts.current.temperatureC, 18.5);
});

test('weather has a twelve-second deadline even when a fetcher ignores cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  let finished = false;
  const pending = weatherContextForChat(
    request('제주 오늘 날씨'),
    (_input, init) => {
      signal = init.signal;
      return new Promise(() => {});
    },
    options,
  );
  void pending.then(() => {
    finished = true;
  });
  t.mock.timers.tick(11_999);
  await Promise.resolve();
  assert.equal(finished, false);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(result.status, 'unavailable');
  assert.equal(signal.aborted, true);
  assert.equal(result.facts, undefined);
});

test('weather deadline also bounds a response body that never completes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = weatherContextForChat(
    request('제주 오늘 날씨'),
    async () =>
      new Response(new ReadableStream({}), {
        headers: { 'content-type': 'application/json' },
      }),
    options,
  );
  t.mock.timers.tick(12_000);
  const result = await pending;
  assert.equal(result.status, 'unavailable');
  assert.equal(result.facts, undefined);
});
