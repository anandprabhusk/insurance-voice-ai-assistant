// src/context/usePolicy.js
import { useContext } from 'react';
import { PolicyContext } from './PolicyContext';

/**
 * Clean architectural hooks gateway for component state allocation
 */
export function usePolicy() {
  const context = useContext(PolicyContext);
  
  if (!context) {
    throw new Error('usePolicy boundary restriction failure. Wrapper must exist inside a PolicyProvider.');
  }

  return {
    policy: context.state,
    dispatch: context.dispatch
  };
}