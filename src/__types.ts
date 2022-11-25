import {
  IComputedValue,
  IObservable,
  IObservableArray,
  IObservableValue, ObservableMap, ObservableSet,
} from 'mobx'

export type IFunction = (...args: any[]) => void;

export interface TrackedAction extends IFunction {
  trackedAction: boolean;
  pending: boolean;
  error?: Error;
  response?: any;
  success: boolean;
  reset: () => void;
}

export type AsyncItem<T = any> = Promise<T> | TrackedAction | IGettable<T> | IFunction;

export type IGettable<T = any> =
  | IObservable
  | IComputedValue<T>
  | IObservableValue<T>
  | IObservableArray
  | ObservableMap
  | ObservableSet;
