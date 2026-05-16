const prefix = '[cv-builder-api]';

export const logger = {
  info: (...args) => console.log(prefix, ...args),
  warn: (...args) => console.warn(prefix, ...args),
  error: (...args) => console.error(prefix, ...args),
};
