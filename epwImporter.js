//@ts-check
/**
 *
 */
class EpwImporter {
    /**
     *
     */
    #e
    /**
     *
     */
    #fr
    /**
     *
     */
    #hr
    /**
     * @param {HTMLInputElement} e
     * @param {HistogramRender} hr
     */
    constructor(e, hr) {
        this.#e = e
        this.#hr = hr
        this.#fr = new FileReader()
        this.#fr.addEventListener("load", () => {
            const result = this.#fr.result
            if(typeof result != "string") throw new Error("Wrong result type?")
            const p = new EpwParser(result)
            const h = new Histogram(p, 0.05)
            this.#hr.histogram = h

            this.#hr.render()
        })
    }

    /**
     *
     */
    init() {
        this.#e.addEventListener("change", () => {
            if(this.#e.files?.length) {
                this.#fr.readAsText(this.#e.files[0])
            }
        })
    }
}