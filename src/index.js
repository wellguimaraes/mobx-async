import { action, computed, observable, reaction } from 'mobx'

export function dependsOn(...anything) { }

export function asyncComputed(target, key, descriptor) {
  const originalGetter = descriptor.get

  const obsValue   = observable.box(undefined)
  const obsPending = observable.box(false)
  const obsError   = observable.box(undefined)

  const pendingKey = key + 'Pending'
  const errorKey = key + 'Error'

  // noinspection JSUnresolvedFunction
  Object.defineProperty( target, pendingKey, computed(target, pendingKey, {
    get() {
      return obsPending.get()
    }
  }))

  // noinspection JSUnresolvedFunction
  Object.defineProperty( target,errorKey,computed(target, errorKey, {
    get() {
      return obsError.get()
    }
  }))

  async function computer() {
    obsPending.set(true)

    try {
      let value = await originalGetter.call(this)
      obsValue.set(value)
      obsPending.set(false)
      obsError.set(undefined)
    } catch (err) {
      obsPending.set(false)
      obsError.set(err)
    }
  }

  let firstTime = true

  return computed(target, key, {
    get() {
      if (firstTime) {
        firstTime = false
        reaction(() => computer.call(this), () => {})
      }

      return obsValue.get()
    }
  })
}

export function asyncAction(target, key, descriptor) {
  const original = descriptor.value

  const fnState = observable({
    pending : false,
    success : false,
    error   : undefined,
    response: undefined
  })

  const actionWrapper = action(function () {
    fnState.pending  = true
    fnState.success  = false
    fnState.error    = undefined
    fnState.response = undefined

    return Promise
      .resolve(original.apply(this, arguments))
      .then(
        (response) => {
          fnState.pending  = false
          fnState.success  = true
          fnState.error    = undefined
          fnState.response = response
        },
        (err) => {
          fnState.response = undefined
          fnState.pending  = false
          fnState.error    = err
        }
      )
  })

  descriptor.value = actionWrapper

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

  actionWrapper.reset = () => {
    fnState.pending  = false
    fnState.success  = false
    fnState.error    = undefined
    fnState.response = undefined
  }

  return descriptor
}