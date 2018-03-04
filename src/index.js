import { action, computed, extendObservable, observable } from 'mobx'

export function dependsOn(anything) { }

export function asyncComputed(target, key, descriptor) {
  extendObservable(target, {
    [ key ]: computed(descriptor.value)
  })

  return Object.getOwnPropertyDescriptor(target, key)
}

export function asyncAction(target, key, descriptor) {
  const original = descriptor.value

  const fnState = observable({
    pending: false,
    error  : undefined
  })

  const fn = function () {
    fnState.pending = true

    Promise
      .resolve(original.apply(this, arguments))
      .then(
        () => {
          fnState.pending = false
          fnState.error   = undefined
        },
        (err) => {
          fnState.pending = false
          fnState.error   = err
        }
      )
  }

  extendObservable(target, { [ key ]: action(fn) })

  Object.defineProperty(target[ key ], 'pending', {
    get: () => fnState.pending
  })

  Object.defineProperty(target[ key ], 'error', {
    get: () => fnState.error
  })

  return Object.getOwnPropertyDescriptor(target, key)
}