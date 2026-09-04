import { getContainer, type Container } from './container';

export type AppContext = {
  readonly container: Container;
};

export function createContext(): AppContext {
  return { container: getContainer() };
}
