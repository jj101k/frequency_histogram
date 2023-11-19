// Originally from "Auxiliary Programs" on the EnergyPlus web site

//@ts-check
/// <reference path="types.d.ts" />

/**
 * @abstract
 * @template T
 */
class EpwField {
    /**
     *
     */
    #offset

    /**
     *
     */
    get offset() {
        return this.#offset
    }

    /**
     *
     * @param {number} offset
     */
    constructor(offset) {
        this.#offset = offset
    }
    /**
     * @protected
     *
     * @param {string[]} lineParts
     * @returns {string}
     */
    extract(lineParts) {
        return lineParts[this.#offset]
    }
    /**
     * @abstract
     *
     * @param {string[]} lineParts
     * @returns {T}
     */
    parse(lineParts) {
        throw new Error("Not implemented")
    }
}


/**
 * @abstract
 * @template {number | null} T
 * @extends {EpwField<T>}
 */
class EpwBaseNumberField extends EpwField {
    /**
     * @protected
     *
     * @param {string[]} lineParts
     */
    getNumber(lineParts) {
        const c = this.extract(lineParts)
        const v = +c
        if(Number.isNaN(v)) {
            throw new Error(`NaN on offset ${this.offset}: ${c}`)
        }
        return v
    }
}

/**
 * @extends {EpwBaseNumberField<number>}
 */
class EpwPlainNumberField extends EpwBaseNumberField {
    /**
     *
     * @param {string[]} lineParts
     */
    parse(lineParts) {
        return this.getNumber(lineParts)
    }
}

/**
 *
 */
class EpwTextField extends EpwField {
    /**
     *
     * @param {string[]} lineParts
     */
    parse(lineParts) {
        return this.extract(lineParts)
    }
}

/**
 * @extends {EpwBaseNumberField<number | null>}
 */
class EpwNumberField extends EpwBaseNumberField {
    /**
     *
     */
    #min
    /**
     *
     */
    #max
    /**
     *
     */
    #missing
    /**
     *
     * @param {number} offset
     * @param {number | undefined} min
     * @param {number | undefined} max
     * @param {{val: number, isGreaterEqual: boolean} | undefined} missing
     */
    constructor(offset, min, max, missing) {
        super(offset)
        this.#min = min
        this.#max = max
        this.#missing = missing
    }
    /**
     *
     * @param {string[]} lineParts
     */
    parse(lineParts) {
        const v = this.getNumber(lineParts)
        if(this.#missing) {
            if(v == this.#missing.val || (v > this.#missing.val && this.#missing.isGreaterEqual)) {
                return null
            }
        }
        if(this.#min !== undefined && v < this.#min) {
            throw new Error(`Out-of-range: ${v} < ${this.#min}`)
        }
        if(this.#max !== undefined && v > this.#max) {
            throw new Error(`Out-of-range: ${v} > ${this.#max}`)
        }
        return v
    }
}

/**
 * @abstract
 * @template T
 */
class EpwNamedField {
    /**
     * @type {number | undefined}
     */
    #offset
    /**
     * @type {EpwField<T> | undefined}
     */
    #parser

    /**
     * If the frequency should be exponential, this should be true.
     */
    get expectsExponentialFrequency() {
        return false
    }

    /**
     * @abstract
     * @protected
     * @returns {EpwField<T> | undefined}
     */
    getParser() {
        throw new Error("Not implemented")
    }

    /**
     *
     */
    name

    /**
     *
     */
    get offset() {
        return this.#offset
    }

    /**
     *
     */
    set offset(v) {
        this.#offset = v
        this.#parser = this.getParser()
    }

    /**
     *
     * @param {string} name
     */
    constructor(name) {
        this.name = name
    }

    /**
     *
     * @param {string[]} lineParts
     * @returns
     */
    parse(lineParts) {
        return this.#parser?.parse(lineParts)
    }
}

/**
 * @abstract
 */
class EpwNamedNumberField extends EpwNamedField {
    /**
     * If the value is practically exponential, this should be true.
     */
    get exponentialValues() {
        return false
    }

    /**
     * @type {string | undefined}
     */
    get units() {
        return undefined
    }

    /**
     * @abstract
     * @returns {EpwBaseNumberField | undefined}
     */
    getParser() {
        throw new Error("Not implemented")
    }
}

/**
 *
 */
class EpwNamedSimpleNumberField extends EpwNamedNumberField {
    getParser() {
        return this.offset !== undefined ?
            new EpwPlainNumberField(this.offset) :
            undefined
    }
}

/**
 *
 */
class EpwNamedConstrainedNumberField extends EpwNamedNumberField {
    /**
     *
     */
    #options

    get exponentialValues() {
        return ["-"].includes(this.units ?? "")
    }

    get expectsExponentialFrequency() {
        return ["Cd/m2", "lux", "Wh/m2"].includes(this.units ?? "")
    }

    /**
     *
     */
    get options() {
        return this.#options
    }

    /**
     *
     */
    get units() {
        return this.#options.units
    }

    /**
     *
     * @param {string} name
     * @param {numberOptions} options
     */
    constructor(name, options) {
        super(name)
        this.#options = options
    }
    getParser() {
        if(this.offset === undefined) {
            return undefined
        }
        if("missing" in this.#options) {
            return new EpwNumberField(this.offset, this.#options.minimum, this.#options.maximum, {val: this.#options.missing, isGreaterEqual: false})
        } else {
            return new EpwNumberField(this.offset, this.#options.minimum, this.#options.maximum, {val: this.#options.missingGreaterEqual, isGreaterEqual: true})
        }
    }
}

/**
 *
 */
class EpwNamedTextField extends EpwNamedField {
    getParser() {
        return this.offset !== undefined ?
            new EpwTextField(this.offset) :
            undefined
    }
}

/**
 *
 */
const EpwFields = (() => {
    /**
     *
     * @param {string} name
     * @returns
     */
    function PlainNumber(name) {
        return new EpwNamedSimpleNumberField(name)
    }

    /**
     *
     * @param {string} name
     * @returns
     */
    function PlainText(name) {
        return new EpwNamedTextField(name)
    }

    /**
     *
     * @param {string} name
     * @param {numberOptions} options
     * @returns
     */
    function ConstrainedNumber(name, options) {
        return new EpwNamedConstrainedNumberField(name, options)
    }

    const fields = [
        PlainNumber("Year"),
        PlainNumber("Month"),
        PlainNumber("Day"),
        PlainNumber("Hour"),
        PlainNumber("Minute"),
        PlainText("Data Source and Uncertainty Flags"),
        ConstrainedNumber("Dry Bulb Temperature", { units: "C", minimum: -70, maximum: 70, missing: 99.9 }),
        ConstrainedNumber("Dew Point Temperature", { units: "C", minimum: -70, maximum: 70, missing: 99.9 }),
        ConstrainedNumber("Relative Humidity", { missing: 999, minimum: 0, maximum: 110 }),
        ConstrainedNumber("Atmospheric Station Pressure", { units: "Pa", missing: 999999, minimum: 31000, maximum: 120000 }),
        ConstrainedNumber("Extraterrestrial Horizontal Radiation", { units: "Wh/m2", missing: 9999, minimum: 0 }),
        ConstrainedNumber("Extraterrestrial Direct Normal Radiation", { units: "Wh/m2", missing: 9999, minimum: 0 }),
        ConstrainedNumber("Horizontal Infrared Radiation Intensity", { units: "Wh/m2", missing: 9999, minimum: 0 }),
        ConstrainedNumber("Global Horizontal Radiation", { units: "Wh/m2", missing: 9999, minimum: 0 }),
        ConstrainedNumber("Direct Normal Radiation", { units: "Wh/m2", missing: 9999, minimum: 0 }),
        ConstrainedNumber("Diffuse Horizontal Radiation", { units: "Wh/m2", missing: 9999, minimum: 0 }),
        ConstrainedNumber("Global Horizontal Illuminance", { units: "lux", missingGreaterEqual: 999900, minimum: 0 }),
        ConstrainedNumber("Direct Normal Illuminance", { units: "lux", missingGreaterEqual: 999900, minimum: 0 }),
        ConstrainedNumber("Diffuse Horizontal Illuminance", { units: "lux", missingGreaterEqual: 999900, minimum: 0 }),
        ConstrainedNumber("Zenith Luminance", { units: "Cd/m2", missingGreaterEqual: 9999, minimum: 0 }),
        ConstrainedNumber("Wind Direction", { units: "degrees", missing: 999, minimum: 0, maximum: 360 }),
        ConstrainedNumber("Wind Speed", { units: "m/s", missing: 999, minimum: 0, maximum: 40 }),
        ConstrainedNumber("Total Sky Cover", { missing: 99, minimum: 0, maximum: 10 }),
        ConstrainedNumber("Opaque Sky Cover", { missing: 99, minimum: 0, maximum: 10 }),
        ConstrainedNumber("Visibility", { units: "km", missing: 9999, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Ceiling Height", { units: "m", missing: 99999, minimum: 0 /* Assumed */ }),
        PlainNumber("Present Weather Observation"),
        PlainNumber("Present Weather Codes"),
        ConstrainedNumber("Precipitable Water", { units: "mm", missing: 999, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Aerosol Optical Depth", { units: "thousandths", missing: .999, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Snow Depth", { units: "cm", missing: 999, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Days Since Last Snowfall", { missing: 99, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Albedo", { missing: 999, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Liquid Precipitation Depth", { units: "mm", missing: 999, minimum: 0 /* Assumed */ }),
        ConstrainedNumber("Liquid Precipitation Quantity", { units: "hr", missing: 99, minimum: 0 /* Assumed */ }),
    ]

    for(const i in fields) {
        fields[i].offset = +i
    }
    return fields
})()
