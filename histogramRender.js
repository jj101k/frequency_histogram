//@ts-check

/**
 *
 */
class HistogramRender {
    /**
     *
     */
    #container
    /**
     * @type {SVGPathElement | undefined}
     */
    #path

    /**
     *
     */
    #plain = false

    /**
     * @type {SVGSVGElement | undefined}
     */
    #svg

    /**
     * @type {EpwNamedNumberField}
     */
    #field

    /**
     *
     * @returns {[SVGPathElement, SVGSVGElement]}
     */
    #init() {
        const document = this.#container.ownerDocument
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("viewBox", "0 0 1000 1000")
        svg.style.width = "1000px"
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("d", "")
        path.setAttribute("stroke", "red")
        path.setAttribute("stroke-width", "0.05")
        path.setAttribute("fill", "none")
        svg.append(path)
        this.#container.append(svg)
        return [path, svg]
    }

    /**
     *
     */
    debug = false

    /**
     * @type {Histogram | undefined}
     */
    histogram

    /**
     *
     */
    get field() {
        return this.#field
    }
    set field(v) {
        this.#field = v
        this.render()
    }

    /**
     *
     */
    get plain() {
        return this.#plain
    }
    set plain(v) {
        this.#plain = v
        this.render()
    }

    /**
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        this.#container = container
    }

    /**
     *
     * @returns
     */
    render() {
        if(this.plain) {
            return this.renderPlain()
        } else {
            return this.renderDelta()
        }
    }

    /**
     *
     */
    renderDelta() {
        if(!this.histogram) {
            return
        }
        if(!this.#svg || !this.#path) {
            [this.#path, this.#svg] = this.#init()
        }
        this.histogram.fieldInfo = {field: this.#field}
        const cumulativeDeltas = this.histogram.cumulativeDeltas
        const firstPos = {y: cumulativeDeltas[0].y - 0.1, fV: 0}
        let dA = `M ${firstPos.y} ${firstPos.fV}`
        let minX = cumulativeDeltas[0].y
        let maxX = cumulativeDeltas[cumulativeDeltas.length - 1].y
        let minY = 0
        let maxY = -Infinity

        const displayFrequency = this.#field.expectsExponentialFrequency ?
            (f) => -Math.log(f) : (f) => -f

        let trueMinY = 0
        let trueMaxY = 0
        for(const d of cumulativeDeltas) {
            const v = displayFrequency(d.f)
            if(v > trueMaxY) {
                trueMaxY = v
            }
            if(v < trueMinY) {
                trueMinY = v
            }
        }

        const renderSquare = cumulativeDeltas.length < 20

        const rescale = (maxX - minX) / ((trueMaxY - trueMinY) * 4)

        if(this.debug) {
            console.log(cumulativeDeltas)
        }

        if(renderSquare) {
            let lastPos = firstPos
            for(const d of cumulativeDeltas) {
                const v = displayFrequency(d.f) * rescale
                const lA = `L ${d.y},${lastPos.fV} L ${d.y},${v}`
                if(this.debug) {
                    console.log(lA)
                }
                lastPos = {y: d.y, fV: v}
                dA += " " + lA
                if(v > maxY) {
                    maxY = v
                }
                if(v < minY) {
                    minY = v
                }
            }
        } else {
            for(const d of cumulativeDeltas) {
                const v = displayFrequency(d.f) * rescale
                const lA = `L ${d.y},${v}`
                if(this.debug) {
                    console.log(lA)
                }
                dA += " " + lA
                if(v > maxY) {
                    maxY = v
                }
                if(v < minY) {
                    minY = v
                }
            }
        }

        const box = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
        if(this.debug) {
            console.log(box)
        }
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
        const strokeWidth = `${(maxX - minX) / 800}`
        if(this.debug) {
            console.log(strokeWidth)
        }
        this.#path.setAttribute("stroke-width", strokeWidth)
    }

    /**
     *
     */
    renderPlain() {
        if(!this.histogram) {
            return
        }
        if(!this.#svg || !this.#path) {
            [this.#path, this.#svg] = this.#init()
        }
        this.histogram.fieldInfo = {field: this.#field}
        const frequencies = this.histogram.frequencies
        const firstPos = {y: frequencies[0].y - 0.1, fV: 0}
        let dA = `M ${firstPos.y} ${firstPos.fV}`
        let minX = frequencies[0].y
        let maxX = frequencies[frequencies.length - 1].y
        let minY = 0
        let maxY = -Infinity

        let trueMinY = 0
        let trueMaxY = 0
        for(const d of frequencies) {
            const v = d.f
            if(v > trueMaxY) {
                trueMaxY = v
            }
            if(v < trueMinY) {
                trueMinY = v
            }
        }

        const renderSquare = frequencies.length < 20

        const rescale = (maxX - minX) / ((trueMaxY - trueMinY) * 4)

        if(this.debug) {
            console.log(frequencies)
        }
        if(renderSquare) {
            let lastPos = firstPos
            for(const d of frequencies) {
                const v = -d.f * rescale // -Math.log(d.f)
                const lA = `L ${d.y},${lastPos.fV} L ${d.y},${v}`
                if(this.debug) {
                    console.log(lA)
                }
                lastPos = {y: d.y, fV: v}
                dA += " " + lA
                if(v > maxY) {
                    maxY = v
                }
                if(v < minY) {
                    minY = v
                }
            }
        } else {
            for(const d of frequencies) {
                const v = -d.f * rescale // -Math.log(d.f)
                const lA = `L ${d.y},${v}`
                if(this.debug) {
                    console.log(lA)
                }
                dA += " " + lA
                if(v > maxY) {
                    maxY = v
                }
                if(v < minY) {
                    minY = v
                }
            }
        }

        const box = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
        if(this.debug) {
            console.log(box)
        }
        this.#svg.setAttribute("viewBox", box)

        this.#path.setAttribute("d", dA)
        const strokeWidth = `${(maxX - minX) / 800}`
        if(this.debug) {
            console.log(strokeWidth)
        }
        this.#path.setAttribute("stroke-width", strokeWidth)
    }
}