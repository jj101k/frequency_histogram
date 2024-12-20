/**
 *
 */
class RenderPath {
    /**
     * @abstract
     * @param {Path} path
     */
    setCompiledPath(path) {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @param {string} style
     */
    setFillStyle(style) {
        throw new Error("Not implemented")
    }
    /**
     * @abstract
     * @param {string} style
     */
    setStrokeStyle(style) {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @param {number} width
     */
    setStrokeWidth(width) {
        throw new Error("Not implemented")
    }
}

/**
 * @abstract
 * @template {RenderPath} P
 */
class RenderContext {
    /**
     * @abstract
     * @param {number} strokeWidth
     * @param {PositionScaler} scaler
     * @param {{x?: boolean}} labels
     * @returns {{append(path: RenderPath): *}}
     */
    addAxes(strokeWidth, scaler, labels) {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @returns {P}
     */
    addPath() {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @param {P} path
     */
    append(path) {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @returns {void}
     */
    deinit() {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @returns {void}
     */
    reinit() {
        throw new Error("Not implemented")
    }

    /**
     * @abstract
     * @param {{x: number, y: number, w: number, h: number}} box
     */
    setViewBox(box) {
        throw new Error("Not implemented")
    }
}
