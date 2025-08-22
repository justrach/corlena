import type { GlobalConfig } from './types';

let config: Required<GlobalConfig> = {
  passive: true,
  defaultCursor: 'grabbing',
  rafStrategy: 'auto',
  pixelRatioAware: true,
  ios: { lockGestureZoom: 'during', doubleTapGuard: true }
};

export function configure(partial: GlobalConfig) {
  config = { ...config, ...partial, ios: { ...config.ios, ...partial.ios } } as any;
}

export function getConfig() {
  return config;
}
