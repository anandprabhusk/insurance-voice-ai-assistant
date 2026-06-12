// src/context/PolicyContext.jsx
import React, { createContext, useReducer } from 'react';

const INITIAL_STATE = {
  productType: null,
  carValue: 0,
  carBrand: '',
  carYear: '',
  addons: [],
  totalPremium: 0
};

function calculatePremium(state) {
  let baseCalculatedSum = 0;
  if (!state.productType) return 0;

  if (state.productType === 'car_comprehensive') {
    baseCalculatedSum = state.carValue * 0.022;
    if (baseCalculatedSum > 0 && baseCalculatedSum < 1250) baseCalculatedSum = 1250;
  } else if (state.productType === 'car_tpl') {
    baseCalculatedSum = 600;
  }

  state.addons.forEach(addon => {
    if (addon === 'agency_repair') baseCalculatedSum += 350;
  });

  return Math.round(baseCalculatedSum);
}

function policyReducer(state, action) {
  let updatedState;
  switch (action.type) {
    case 'SELECT_PRODUCT':
      updatedState = { ...state, productType: action.payload, carValue: action.payload === 'car_tpl' ? 0 : state.carValue };
      break;
    case 'UPDATE_CAR_VALUE':
      updatedState = { ...state, carValue: Number(action.payload) };
      break;
    case 'UPDATE_CAR_DETAILS':
      updatedState = { ...state, carBrand: action.payload.carBrand || state.carBrand, carYear: action.payload.carYear || state.carYear };
      break;
    case 'ADD_ADDON':
      updatedState = state.addons.includes(action.payload) ? state : { ...state, addons: [...state.addons, action.payload] };
      break;
    case 'REMOVE_ADDON':
      updatedState = { ...state, addons: state.addons.filter(item => item !== action.payload) };
      break;
    case 'CLEAR_CART':
      return INITIAL_STATE;
    default:
      return state;
  }
  updatedState.totalPremium = calculatePremium(updatedState);
  return updatedState;
}

// Export the raw Context object purely
export const PolicyContext = createContext(null);

// Export the Provider component purely (Satisfies Fast Refresh)
export function PolicyProvider({ children }) {
  const [state, dispatch] = useReducer(policyReducer, INITIAL_STATE);
  return (
    <PolicyContext.Provider value={{ state, dispatch }}>
      {children}
    </PolicyContext.Provider>
  );
}