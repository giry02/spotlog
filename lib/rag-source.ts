/** The exact authored sample source used by both indexing and current-source checks. */
export function authoredPlaceText(place: {
  name: string;
  region: string;
  description: string;
  tags: string[];
}) {
  return `${place.name}\n지역: ${place.region}\n제작 설명: ${place.description}\n제작 특징: ${place.tags.join(', ')}`;
}
