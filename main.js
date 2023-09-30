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
    e?.addEventListener("change", function(event) {
        if(event.target instanceof HTMLInputElement && event.target.files) {
            const fr = new FileReader()
            fr.onload = () => {
                if(typeof fr.result != "string") throw new Error("Wrong result type?")
                const r = new EpwParser(fr.result).getValues(EpwFields[7])
                console.log(r)
                const h = new Histogram(r, 0.05)

                hr.render(h)
            }
            fr.readAsText(event.target.files[0])
        }
    })
}
main()