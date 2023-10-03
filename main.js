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

    /** @type {HTMLSelectElement | null} */
    const ex = document.querySelector("#field")
    if(!ex) {
        throw new Error("Cannot find selector")
    }
    const optReader = new HistogramOptionsReader(ex, hr, document.querySelector("#logging"))
    optReader.init()
    optReader.value = EpwFields.find(f => f.name == "Dry Bulb Temperature")
}
main()