//@ts-check

/**
 *
 */
class HistogramOptionsReader {
    /**
     *
     */
    #field

    /**
     *
     */
    #hr

    /**
     *
     */
    #loggingToggle

    /**
     *
     */
    get value() {
        return EpwFields[this.#field.value]
    }
    set value(v) {
        const index = EpwFields.indexOf(v)
        if(index == -1) {
            throw new Error("Value not allowed")
        }
        this.#field.value = "" + index
        this.#hr.field = this.value
    }
    /**
     *
     * @param {HTMLSelectElement} field
     * @param {HistogramRender} hr
     * @param {HTMLInputElement | null} loggingToggle
     */
    constructor(field, hr, loggingToggle) {
        this.#field = field
        this.#hr = hr
        this.#loggingToggle = loggingToggle
    }
    /**
     *
     */
    init() {
        const document = this.#field.ownerDocument
        for(const [i, field] of Object.entries(EpwFields)) {
            if(field instanceof EpwNamedNumberField) {
                const option = document.createElement("option")
                option.value = i
                option.textContent = field.name
                this.#field.append(option)
            }
        }
        this.#field.addEventListener("change", () => {
            this.#hr.field = this.value
        })
        this.#hr.field = this.value
        this.#loggingToggle?.addEventListener("change", () => {
            this.#hr.debug = this.#loggingToggle?.checked ?? false
        })
        this.#hr.debug = this.#loggingToggle?.checked ?? false
    }
}