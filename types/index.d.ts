export type IsOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'hebrew-rtl': { isOn: IsOn }
  }
}
