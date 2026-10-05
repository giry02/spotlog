import { publicTourismSources, type PublicTourismSource } from './publicTourismContent';
import { licensedPlaceSources } from './licensedPlaceSources';

/** Public tourism and CC photos keep their own attribution and license terms. */
export interface PhotoSource extends Omit<PublicTourismSource, 'license' | 'coordinateSourceUrl'> {
  license: PublicTourismSource['license'] | 'CC BY-SA 3.0' | 'CC BY-SA 4.0';
  coordinateSourceUrl?: string;
  originalTitle?: string;
  changes?: string;
  reuseNote?: string;
  caption?: string;
  objectPosition?: string;
}

export const photoSources: PhotoSource[] = [...publicTourismSources, ...licensedPlaceSources];
const sourcesByImage = new Map(photoSources.map((source) => [source.image, source]));
export function getPhotoSource(image: string): PhotoSource | undefined {
  return sourcesByImage.get(image);
}
