import { SvgXml } from 'react-native-svg';

import { flowerLogoXml } from './flowerLogoXml';

type FlowerLogoProps = {
  /** Scales the 104×104 viewBox uniformly. */
  size?: number;
};

export function FlowerLogo({ size = 104 }: FlowerLogoProps) {
  return <SvgXml xml={flowerLogoXml} width={size} height={size} />;
}
