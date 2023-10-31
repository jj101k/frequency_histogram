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
     * @type {{[event_name: string]: (() => any)[]}}
     */
    #eventListeners = {}
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
            const h = new Histogram(p)
            this.#hr.histogram = h

            this.dispatchEvent(new Event("import"))

            this.#hr.render()
        })
    }

    /**
     *
     * @param {"import"} event_name
     * @param {() => any} handler
     */
    addEventListener(event_name, handler) {
        this.#eventListeners[event_name] = this.#eventListeners[event_name] || []
        this.#eventListeners[event_name].push(handler)
    }

    /**
     *
     * @param {Event} event
     */
    dispatchEvent(event) {
        if(this.#eventListeners[event.type]) {
            for(const l of this.#eventListeners[event.type]) {
                l()
            }
        }
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

    /**
     *
     * @param {"import"} event_name
     * @param {() => any} handler
     */
    removeEventListener(event_name, handler) {
        if(this.#eventListeners[event_name]) {
            this.#eventListeners[event_name] = this.#eventListeners[event_name].filter(
                v => v != handler
            )
        }
    }
}