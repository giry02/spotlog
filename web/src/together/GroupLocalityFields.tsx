import { useId } from 'react';
import { groupDistrictOptions, groupNeighborhoodOptions, groupRegionNeedsDistrict, groupRegionOptions } from './groupRegions';
import './group-locality-fields.css';

export interface GroupLocalityValue {
  region: string;
  district: string;
  neighborhood: string;
}
export interface GroupLocalityFieldsProps {
  region: string;
  district: string;
  neighborhood?: string;
  onChange: (value: GroupLocalityValue) => void;
  label?: string;
  idPrefix?: string;
  ariaPrefix?: string;
  mode?: 'CREATE' | 'FILTER';
  regionOptions?: readonly string[];
  districtOptions?: readonly string[];
  neighborhoodOptions?: readonly string[];
  neighborhoodMaxLength?: number;
  hint?: string;
}

/** A user-chosen meeting area, never a residence, GPS position or inferred travel radius. */
export default function GroupLocalityFields({ region, district, neighborhood = '', onChange, label = '활동 지역', idPrefix, ariaPrefix = '모임', mode = 'CREATE', regionOptions: suppliedRegions = [], districtOptions: suppliedDistricts = [], neighborhoodOptions: suppliedNeighborhoods = [], neighborhoodMaxLength = 100, hint }: GroupLocalityFieldsProps) {
  const generatedId = useId();
  const id = idPrefix || generatedId;
  const needsDistrict = groupRegionNeedsDistrict(region);
  const showDistrict = needsDistrict || Boolean(district);
  const regions = groupRegionOptions([...suppliedRegions, ...(region ? [region] : [])]);
  const districts = groupDistrictOptions(region, [...suppliedDistricts, ...(district ? [district] : [])]);
  const neighborhoods = groupNeighborhoodOptions(region, district, [...suppliedNeighborhoods, ...(neighborhood ? [neighborhood] : [])]);
  const filtering = mode === 'FILTER';
  const blockedNeighborhood = !region || (needsDistrict && !district);
  const description = hint ?? (blockedNeighborhood ? '시·도와 시·군·구를 고르면 동·읍·면도 정할 수 있어요.' : '동·읍·면은 직접 적어도 돼요. 상세 주소는 입력하지 않아요.');

  return <fieldset className="group-locality-fields" aria-describedby={`${id}-hint`}>
    <legend>{label}<small>{filtering ? '같은 지역의 모임을 찾아요' : '구·동까지 정할 수 있어요'}</small></legend>
    <div className="group-locality-fields__grid" data-field-count={showDistrict ? 3 : 2}>
      <label className="group-locality-fields__region" htmlFor={`${id}-region`}><span>시·도</span><select id={`${id}-region`} aria-label={`${ariaPrefix} 시·도`} value={region} onChange={event => onChange({ region: event.target.value, district: '', neighborhood: '' })}>
        <option value="">{filtering ? '전체 지역' : '미정'}</option>{regions.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      {showDistrict && <label className="group-locality-fields__district" htmlFor={`${id}-district`}><span>{needsDistrict ? '시·군·구' : '기존 행정구역'}</span><select id={`${id}-district`} aria-label={`${ariaPrefix} 시·군·구`} disabled={!region} value={district} onChange={event => onChange({ region, district: event.target.value, neighborhood: '' })}>
        <option value="">{filtering ? '전체 시·군·구' : needsDistrict ? '구·군 선택' : '해당 없음'}</option>{districts.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>}
      <label className="group-locality-fields__neighborhood" htmlFor={`${id}-neighborhood`}><span>동·읍·면</span><input id={`${id}-neighborhood`} aria-label={`${ariaPrefix} 동·읍·면`} list={`${id}-neighborhoods`} value={neighborhood} maxLength={neighborhoodMaxLength} disabled={blockedNeighborhood} placeholder={filtering ? '전체 동·읍·면' : '동 이름 입력'} autoComplete="off" onChange={event => onChange({ region, district, neighborhood: event.target.value })}/><datalist id={`${id}-neighborhoods`}>{neighborhoods.map(value => <option key={value} value={value}/>)}</datalist></label>
    </div>
    <p id={`${id}-hint`} className="group-locality-fields__hint">{description}</p>
  </fieldset>;
}
