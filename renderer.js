/// <reference path="epwDataFormat.js" />

/**
 * @typedef {{type: "move", x: number, y: number}} PathMove
 * @typedef {{type: "line", x: number, y: number}} PathLine
 * @typedef {PathMove | PathLine} PathComponent
 * @typedef {PathComponent[]} Path
 */

/**
 *
 */
class SvgPathRenderer {
    /**
     *
     */
    #bottomRight

    /**
     * @type {Path}
     */
    #compiledPath

    /**
     * @type {Path[]}
     */
    #compiledPaths = []

    /**
     *
     */
    #topLeft

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    #fit(pos) {
        if(pos.x < this.#topLeft.x) {
            this.#topLeft.x = pos.x
        }
        if(pos.x > this.#bottomRight.x) {
            this.#bottomRight.x = pos.x
        }
        if(pos.y < this.#topLeft.y) {
            this.#topLeft.y = pos.y
        }
        if(pos.y > this.#bottomRight.y) {
            this.#bottomRight.y = pos.y
        }
    }

    /**
     *
     */
    get box() {
        return {
            x: this.#topLeft.x,
            y: this.#topLeft.y,
            w: this.#bottomRight.x - this.#topLeft.x,
            h: this.#bottomRight.y - this.#topLeft.y,
        }
    }

    /**
     *
     */
    get compiledPath() {
        return this.#compiledPath
    }

    /**
     *
     */
    get compiledPaths() {
        return [
            ...this.#compiledPaths,
            this.compiledPath
        ]
    }

    /**
     *
     * @param {{x: number, y: number}} firstPos
     */
    constructor(firstPos) {
        this.#compiledPath = this.#newPath(firstPos)
        this.#topLeft = {x: firstPos.x, y: firstPos.y}
        this.#bottomRight = {x: firstPos.x, y: firstPos.y}
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     * @returns {Path}
     */
    #newPath(pos) {
        return [{type: "move", ...pos}]
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    addPathFrom(pos) {
        this.#compiledPaths.push(this.#compiledPath)
        this.#compiledPath = this.#newPath(pos)
        this.#fit(pos)
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    line(pos) {
        if(Number.isNaN(pos.x) || Number.isNaN(pos.y)) {
            console.error(pos)
            throw new Error("NaN position")
        }
        this.#compiledPath.push({type: "line", ...pos})
        this.#fit(pos)
    }

    /**
     *
     * @param {{x: number, y: number}} pos
     */
    moveTo(pos) {
        if(Number.isNaN(pos.x) || Number.isNaN(pos.y)) {
            console.error(pos)
            throw new Error("NaN position")
        }
        this.#compiledPath.push({type: "move", ...pos})
        this.#fit(pos)
    }
}

/**
 * @abstract
 * @template F
 */
class Renderer {
    /**
     * @protected
     */
    scaler

    /**
     * @protected
     *
     * @param {number} minX
     * @param {number} maxX
     * @returns
     */
    getStrokeWidth(minX, maxX) {
        return (maxX - minX) / 800 // TODO heuristic
    }

    /**
     * @protected
     *
     * @param {F[]} values
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, pathRenderer, firstPos) {
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        for (const d of values) {
            const y = this.scaler.displayY(d)
            const x = this.scaler.displayX(d)
            pathRenderer.line({ x, y })
        }
        return this.getStrokeWidth(firstPos.x, this.scaler.displayX(values[values.length - 1]))
    }

    /**
     *
     * @param {PositionScaler<F>} scaler
     */
    constructor(scaler) {
        this.scaler = scaler
    }

    /**
     *
     * @param {F[]} values
     * @param {F[]} [fitting]
     * @returns
     */
    renderValues(values, fitting) {
        // The X scaler is fixed - it's whatever it naturally is.
        const xRange = this.scaler.xScaler.prepare(values)
        // The Y scaler may be rescaled
        const expandedYValues = [...values, ...(fitting ?? [])]
        const scaleYTo = xRange / 4 // TODO This is a heuristic value
        this.scaler.yScaler.prepare(expandedYValues, scaleYTo)

        const minX = this.scaler.displayX(values[0])
        const maxX = this.scaler.displayX(values[values.length - 1])

        const firstPos = { x: this.scaler.displayX(values[0]), y: this.scaler.displayY(values[0]) }
        const pathRenderer = new SvgPathRenderer({x: firstPos.x, y: firstPos.y})

        const dataStrokeWidth = this.renderValuePoints(values, pathRenderer, firstPos)

        const box = pathRenderer.box

        const boxProportionateStrokeWidth = this.getStrokeWidth(box.y, box.y + box.h)

        return {compiledPaths: pathRenderer.compiledPaths,
            box,
            // TODO improve
            axisStrokeWidth: Math.max(
                this.getStrokeWidth(minX, maxX),
                boxProportionateStrokeWidth
            ),
            dataStrokeWidth: Math.max(dataStrokeWidth, boxProportionateStrokeWidth),
        }
    }
}

/**
 * @extends {Renderer<HistogramDatum>}
 */
class FrequencyRenderer extends Renderer {
    /**
     *
     * @param {HistogramDatum[]} values
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, pathRenderer, firstPos) {
        // Last point is handled specially.
        const tail = values.pop()

        let lastPos = firstPos
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        const renderSquare = values.length < FrequencyPositionScaler.renderSquareLimit
        if (renderSquare) {
            for (const d of values) {
                const x = this.scaler.displayX(d)
                const y = this.scaler.displayY(d)
                pathRenderer.line({ x, y: lastPos.y })
                pathRenderer.line({ x, y })
                lastPos = { x, y }
            }
        } else {
            for (const d of values) {
                const x = this.scaler.displayX(d)
                const y = this.scaler.displayY(d)
                pathRenderer.line({ x, y })
                lastPos = { x, y }
            }
        }

        // Always a horizontal line to the last point, for symmetry with the first
        if(tail) {
            pathRenderer.line({x: this.scaler.displayX(tail), y: lastPos.y})
        }

        return this.getStrokeWidth(firstPos.x, this.scaler.displayX(values[values.length - 1]))
    }
}

/**
 * @extends {Renderer<RawDatum>}
 */
class RawOverlapRenderer extends Renderer {
    /**
     *
     * @param {RawDatum[]} values
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, pathRenderer, firstPos) {
        let lastPos = firstPos
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        for (const d of values) {
            const x = this.scaler.displayX(d)
            const y = this.scaler.displayY(d)
            if(x < lastPos.x) {
                pathRenderer.addPathFrom({x, y})
            }
            pathRenderer.line({ x, y })
            lastPos = { x, y }
        }

        return this.getStrokeWidth(0, 24)
    }
}

/**
 * @extends {Renderer<HistogramDatum>}
 */
class HistogramPositionRenderer extends Renderer {
    /**
     *
     * @param {HistogramDatum[]} values
     * @param {SvgPathRenderer} pathRenderer
     * @param {{x: number, y: number}} firstPos
     * @returns
     */
    renderValuePoints(values, pathRenderer, firstPos) {
        if(Number.isNaN(firstPos.x) || Number.isNaN(firstPos.y)) {
            console.error(firstPos)
            throw new Error("First position is NaN")
        }
        // These are always discrete
        for (const d of values) {
            const x = this.scaler.displayX(d)
            const y = this.scaler.displayY(d)
            pathRenderer.addPathFrom({x, y: this.scaler.displayY({f: 0, y: 0})})
            pathRenderer.line({ x, y })
        }

        return ((this.scaler.displayX(values[values.length - 1]) - firstPos.x) / values.length) * 0.8 // Not quite full
    }
}