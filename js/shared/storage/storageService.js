export function createStorageService({
  storage = globalThis.localStorage,
  prefix = '',
} = {}) {
  function resolveKey(key) {
    return `${prefix}${key}`;
  }

  function getRaw(key) {
    if (!storage?.getItem) return null;
    return storage.getItem(resolveKey(key));
  }

  function set(key, value) {
    if (!storage?.setItem) return;
    storage.setItem(resolveKey(key), String(value));
  }

  function remove(key) {
    if (!storage?.removeItem) return;
    storage.removeItem(resolveKey(key));
  }

  function getString(key, { defaultValue = '' } = {}) {
    const value = getRaw(key);
    return value ?? defaultValue;
  }

  function getBoolean(key, { defaultValue = false } = {}) {
    const value = getRaw(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
  }

  function getNumber(
    key,
    {
      defaultValue = 0,
      parse = value => Number(value),
      validate = value => Number.isFinite(value),
    } = {},
  ) {
    const rawValue = getRaw(key);
    if (rawValue === null) return defaultValue;
    const parsedValue = parse(rawValue);
    return validate(parsedValue) ? parsedValue : defaultValue;
  }

  function getJson(key, { defaultValue = null } = {}) {
    const rawValue = getRaw(key);
    if (rawValue === null) return defaultValue;

    try {
      return JSON.parse(rawValue);
    } catch {
      return defaultValue;
    }
  }

  return {
    getRaw,
    set,
    remove,
    getString,
    getBoolean,
    getNumber,
    getJson,
  };
}
