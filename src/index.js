import { action, computed, observable, reaction } from 'mobx'

function asyncComputedDecorator({ initialValue }, target, key, descriptor) {
  const originalGetter = descriptor.get

  const obsValue   = observable.box(initialValue)
  const obsPending = observable.box(false)
  const obsError   = observable.box(undefined)

  async function computer() {
    obsPending.set(true)

    try {
      const value = await originalGetter.call(this)
      obsValue.set(value)
      obsPending.set(false)
      obsError.set(undefined)
    } catch (err) {
      obsPending.set(false)
      obsError.set(err)
    }
  }

  const computedObj = {}
  let firstTime     = true

  // noinspection JSUnresolvedFunction
  Object.defineProperty(target, '__' + key, computed(target, '__' + key, {
    enumerable: false,
    get() {
      if (firstTime) {
        firstTime = false
        obsPending.set(true)
        reaction(() => computer.call(computedObj.context), () => {})
      }

      return obsValue.get()
    }
  }))

  // noinspection JSUnresolvedFunction
  Object.defineProperty(computedObj, 'pending', computed(computedObj, 'pending', { get: () => obsPending.get() }))

  // noinspection JSUnresolvedFunction
  Object.defineProperty(computedObj, 'error', computed(computedObj, 'error', { get: () => obsError.get() }))

  // noinspection JSUnresolvedFunction
  Object.defineProperty(computedObj, 'value', computed(computedObj, 'value', {
    get() {
      return computedObj.context[ '__' + key ]
    }
  }))

  return computed(target, key, {
    get() {
      if (computedObj.context === undefined)
        computedObj.context = this

      return computedObj
    }
  })
}

export function dependsOn(...anything) { }

export function asyncComputed() {
  if (arguments.length === 1 && typeof arguments[ 0 ] === 'object')
    return asyncComputedDecorator.bind(null, arguments[ 0 ])
  else
    return asyncComputedDecorator({}, arguments[ 0 ], arguments[ 1 ], arguments[ 2 ])
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