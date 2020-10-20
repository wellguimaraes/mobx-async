import {
  IComputedValue,
  IObservable,
  IObservableArray,
  IObservableObject,
  IObservableValue,
  observable,
  ObservableMap,
  ObservableSet,
  runInAction
} from 'mobx'
import { fromPromise } from 'mobx-utils'

type IFunction = (...args: any[]) => void

interface TrackedAction extends IFunction {
  trackedAction: boolean
  pending: boolean
  error?: Error
  response?: any
  success: boolean
  reset: () => void
}

type AsyncItem<T = any> = Promise<T> | TrackedAction | IGettable<T> | IFunction

type IGettable<T = any> =
  | IObservable
  | IComputedValue<T>
  | IObservableValue<T>
  | IObservableObject
  | IObservableArray
  | ObservableMap
  | ObservableSet

export function isPending(v: AsyncItem): boolean {
  validateTrackedAction(v)

  if ((v as TrackedAction)?.trackedAction) {
    return (v as TrackedAction).pending
  }

  const value = toPromise(v as IGettable)

  return fromPromise(value).case({
    fulfilled: () => false,
    pending: () => true,
    rejected: () => false
  })
}

export const getError = (v: AsyncItem): Error | undefined => {
  validateTrackedAction(v)

  if ((v as TrackedAction)?.trackedAction) {
    return (v as TrackedAction)?.error
  }

  const value = toPromise(v as IGettable)

  return fromPromise(value).case({
    fulfilled: () => undefined,
    pending: () => undefined,
    rejected: (err: Error) => err
  })
}

export const succeeded = (action: TrackedAction | IFunction) => {
  validateTrackedAction(action)

  return (action as TrackedAction)?.success
}

function getValue<T>(v: IGettable<Promise<T>> | Promise<T>): T | undefined {
  const value = toPromise(v)

  return fromPromise(value).case({
    fulfilled: (v: any) => v,
    pending: () => undefined,
    rejected: () => undefined
  })
}

export { getValue }

export const resetter = (action: TrackedAction | IFunction): (() => void) => {
  validateTrackedAction(action)

  return (action as TrackedAction)?.reset || (() => {})
}

export function dependsOn(...dependencies: AsyncItem[]) {
  void dependencies.map((it: any) => {
    if (it?.constructor?.name === 'ObservableValue') return it?.get?.()
    if (it?.constructor?.name === 'ComputedValue') return it?.get?.()
    if (it?.trackedAction) return void it?.successVersion?.get()
  })
}

function trackedAction<T extends TrackedAction>(actionBody: T): T
function trackedAction(target: Object, key?: string | symbol, baseDescriptor?: PropertyDescriptor): void
function trackedAction(target: Object, key?: string | symbol, baseDescriptor?: PropertyDescriptor): void {
  let fn = baseDescriptor ? baseDescriptor.value : target

  const fnState = observable.object({
    pending: false,
    success: false,
    error: undefined,
    response: undefined
  })

  const successVersion = observable.box(0)

  const actionWrapper: any = function (this: any, ...args: any[]) {
    runInAction(() => {
      fnState.pending = true
      fnState.success = false
      fnState.error = undefined
      fnState.response = undefined
    })

    return new Promise((resolve, reject) => {
      runInAction(() => {
        try {
          resolve(fn.apply(this, args as any))
        } catch (err) {
          reject(err)
        }
      })
    }).then(
      (response: any) => {
        runInAction(() => {
          successVersion.set(successVersion.get() + 1)
          fnState.pending = false
          fnState.success = true
          fnState.error = undefined
          fnState.response = response
        })

        return Promise.resolve(response)
      },
      err => {
        runInAction(() => {
          fnState.response = undefined
          fnState.pending = false
          fnState.error = err
        })

        return Promise.reject(err)
      }
    )
  }

  Object.defineProperty(actionWrapper, 'successVersion', {
    enumerable: false,
    value: successVersion
  })

  Object.defineProperty(actionWrapper, 'pending', {
    get: () => fnState.pending
  })

  Object.defineProperty(actionWrapper, 'error', {
    get: () => fnState.error
  })

  Object.defineProperty(actionWrapper, 'response', {
    get: () => fnState.response
  })

  Object.defineProperty(actionWrapper, 'success', {
    get: () => fnState.success
  })

  actionWrapper.trackedAction = true
  actionWrapper.reset = () =>
    runInAction(() => {
      fnState.pending = false
      fnState.success = false
      fnState.error = undefined
      fnState.response = undefined
    })

  if (baseDescriptor) {
    let firstRun = true

    return {
      configurable: true,
      get: function (this: any) {
        if (firstRun === true) {
          fn = fn.bind(this)
          firstRun = false
        }

        return actionWrapper
      },
      set(newFn: any) {
        fn = newFn
      }
    } as any
  } else {
    return actionWrapper
  }
}

export { trackedAction }

function validateTrackedAction(v: any) {
  if (typeof v === 'function' && !v.hasOwnProperty('trackedAction')) {
    throw new Error(`${v.name} is not a tracked action`)
  }
}

function toPromise<T>(
  v:
    | IObservable
    | IComputedValue<Promise<T>>
    | IObservableValue<Promise<T>>
    | IObservableObject
    | IObservableArray
    | ObservableMap
    | ObservableSet
    | Promise<T>
) {
  const value =
    v instanceof Promise
      ? Promise.resolve(v)
      : v && typeof (v as any).get === 'function'
      ? Promise.resolve((v as any).get())
      : Promise.resolve()

  return value
}
