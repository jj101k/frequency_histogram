//@ts-check
/// <reference path="./renderContextSvg.js" />
/// <reference path="./epwImporter.js" />
/// <reference path="./node_modules/pathfind/Frameworker.js" />

function main() {
    /**
     * @type {HTMLElement | null}
     */
    const graphContainer = document.querySelector("#graph-container")
    if(!graphContainer) {
        throw new Error("Cannot find graph container")
    }
    const hr = new HistogramRender(
        sessionStorage.useCanvas ? new RenderContextCanvas(graphContainer) : new RenderContextSvg(graphContainer)
    )
    /** @type {HTMLInputElement | null} */
    const e = document.querySelector("#import")
    if(!e) {
        throw new Error("Cannot find import container")
    }
    const importer = new EpwImporter(e, hr)

    const retainedData = {
        get renderer() {
            return sessionStorage.useCanvas
        },
        set renderer(v) {
            if(v !== this.renderer) {
                sessionStorage.useCanvas = v
                location.reload()
            }
        },
        get units() {
            return this.field.units
        },
    }
    Frameworker.proxy(retainedData, hr, ["noiseReduction", "period", "roundToNearest", "debug", "field", "preferLog", "first24", "graphType"],
        {}, [])

    class PeriodOptions extends OptionSet {
        get options() {
            const defaultPeriodOptions = [
                {
                    name: "All",
                    year: null,
                    month: null,
                },
            ]
            if(!hr.histogram) {
                return defaultPeriodOptions
            }
            const yearField = EpwFields.find(field => field.name == "Year")
            const monthField = EpwFields.find(field => field.name == "Month")
            if(!yearField || !monthField) {
                throw new Error("Could not find year/month fields")
            }
            return [
                ...defaultPeriodOptions,
                ...hr.histogram.getUniqueValues([yearField, monthField]).map(([y, m]) => ({
                    name: `${y}-${("" + m).padStart(2, "0")}`,
                    year: y,
                    month: m,
                }))
            ]
        }

        /**
         *
         * @param {{year: number | null, month: number | null} | undefined} value
         * @returns
         */
        optionMatching(value) {
            if(!value) {
                return "" + 0
            }
            return this.options.findIndex(o => o.year === value.year && o.month === value.month)?.toString()
        }

        valueFor(htmlValue) {
            return this.options[htmlValue]
        }
    }

    const f = new Frameworker(retainedData, document, {
        field: new OptionSetLiteral(EpwFields.filter(field => field instanceof EpwNamedNumberField)),
        graphType: new OptionSetMapped([
            {name: "Interpolated Histogram", value: 1},
            {name: "Histogram", value: 0},
            {name: "Raw", value: -1},
            {name: "Raw (Day overlap)", value: -2},
        ]),
        period: new PeriodOptions(),
        renderer: new OptionSetMapped([{name: "SVG", value: ""}, {name: "Canvas", value: "1"}]),
    })
    importer.addEventListener("import", () => {
        const e = new Event("update-options:period")
        f.dispatchEvent(e)
    })
    importer.init()
    f.addEventListener("beforeinit", () => {
        retainedData.field = EpwFields.find(f => f.name == "Dry Bulb Temperature")
    })
    f.init(document.querySelector("section#main"))
}
main()