//@ts-check

function main() {
    /**
     * @type {HTMLElement | null}
     */
    const graphContainer = document.querySelector("#graph-container")
    if(!graphContainer) {
        throw new Error("Cannot find graph container")
    }
    const hr = new HistogramRender(graphContainer)
    /** @type {HTMLInputElement | null} */
    const e = document.querySelector("#import")
    if(!e) {
        throw new Error("Cannot find import container")
    }
    new EpwImporter(e, hr).init()

    const retainedData = {
        /**
         * @type {EpwNamedNumberField[]}
         */
        get fieldOptions() {
            return EpwFields.filter(field => field instanceof EpwNamedNumberField)
        },
        get units() {
            return this.field.units
        },
    }
    Frameworker.proxy(retainedData, hr, ["plain", "debug", "field", "preferLog"],
        {}, [])

    const f = new Frameworker(retainedData)
    f.addEventListener("beforeinit", () => {
        retainedData.field = EpwFields.find(f => f.name == "Dry Bulb Temperature")
    })
    f.init(document.querySelector("section#main"))
}
main()