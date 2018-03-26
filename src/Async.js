import * as React from 'react'
import PropTypes from 'prop-types'

function toArray(it) {
  return Array.isArray(it) ? it : [ it ]
}

export default class Async extends React.Component {

  constructor(props) {
    super(props)

    const values = toArray(props.value || props.values)

    this.state = values
      .map(() => ({
        pending      : true,
        error        : undefined,
        value        : undefined,
        previousValue: undefined
      }))
      .reduce((acc, curr, index) => {
        acc[ index ] = curr
        return acc
      }, {})

    this.handlePromise = this.handlePromise.bind(this)
  }


  componentDidMount() {
    const currValues = toArray(this.props.value || this.props.values)

    currValues.forEach((it, i) => this.handlePromise(it, i))
  }

  componentWillUnmount() {
    this.unmounted = true
  }

  componentWillReceiveProps(nextProps) {
    const currValues = toArray(this.props.value || this.props.values)
    const nextValues = toArray(nextProps.value || nextProps.values)

    nextValues.forEach((it, i) => {
      if (currValues[ i ] !== it) {
        this.handlePromise(it, i)
      }
    })
  }

  handlePromise(promise, index) {
    this.setState({
      [ index ]: {
        pending : true,
        error   : undefined,
        value   : undefined,
        _promise: promise
      }
    }, () => {
      Promise
        .resolve(promise)
        .then((value) => {
          if (this.unmounted) return

          const currPromise = this.state[ index ]._promise

          if (!currPromise || currPromise === promise)
            this.setState({
              [ index ]: {
                value,
                previousValue: this.state[ index ].value,
                pending      : false,
                error        : undefined
              }
            })
        }, (error) => {
          if (this.unmounted) return

          const currPromise = this.state[ index ]._promise

          if (!currPromise || currPromise === promise)
            this.setState({
              [ index ]: {
                value        : undefined,
                previousValue: this.state[ index ].value,
                pending      : false,
                error
              }
            })
        })
    })
  }

  get results() {
    const values = toArray(this.props.value || this.props.values)

    return values.map((ignore, i) => this.state[ i ])
  }

  render() {
    return this.props.children.apply(null, this.results)
  }
}

Async.propTypes = {
  children: PropTypes.func,
  values  : PropTypes.array
}