import { createContext, useContext } from 'react';

export const LiveContext = createContext(true);

export function useLiveState(): boolean {
  return useContext(LiveContext);
}
