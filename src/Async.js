import * as React from 'react'
import PropTypes from 'prop-types'

function toArray(it) {
  return Array.isArray(it) ? it : [ it ]
}

export const switchAsync = (promised, cases) => {
  if (promised.pending)
    return cases.pending && cases.pending()

  if (promised.error)
    return cases.failed && cases.failed()

  return cases.success && cases.success()
}


export default class Async extends React.Component {

  constructor(props) {
    super(props)

    const values = toArray(props.value || props.values)

    this.state = {
      results: values.map(() => ({
        pending: true,
        error  : undefined,
        value  : undefined,
        case(cases) { return switchAsync(this, cases) }
      }))
    }
  }

  componentDidMount() {
    const currValues = toArray(this.props.value || this.props.values)
    currValues.forEach((it, i) => this.handlePromise(it, i))
  }

  componentWillReceiveProps(nextProps) {
    const currValues = toArray(this.props.value || this.props.values)
    const nextValues = toArray(nextProps.value || nextProps.values)

    nextValues.forEach((it, i) => {
      if (currValues[ i ] !== it)
        this.handlePromise(it, i)
    })
  }

  handlePromise = (promise, index) => {
    this.setState({
      results: this.state.results.map((it, i) =>
        i === index
          ? {
            pending: true,
            error  : undefined,
            value  : undefined,
            case(cases) {
              return switchAsync(this, cases)
            }
          }
          : it)
    })

    Promise
      .resolve(promise)
      .then((value) => {
        this.setState({
          results: this.state.results.map((it, i) => i === index
            ? {
              value,
              pending: false,
              error  : undefined,
              case(cases) {
                return switchAsync(this, cases)
              }
            }
            : it)
        })
      }, (error) => {
        this.setState({
          results: this.state.results.map((it, i) => i === index
            ? {
              error,
              pending: false,
              value  : undefined,
              case(cases) {
                return switchAsync(this, cases)
              }
            }
            : it)
        })
      })
  }

  render() {
    const { results } = this.state

    return this.props.children.apply(null, results)
  }
}

Async.propTypes = {
  children: PropTypes.func.isRequired
}