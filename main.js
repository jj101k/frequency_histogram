//@ts-check
/// <reference path="./renderContextSvg.js" />
/// <reference path="./epwImporter.js" />
/// <reference path="../pathfind/Frameworker.js" />

function main() {
    /**
     * @type {HTMLElement | null}
     */
    const graphContainer = document.querySelector("#graph-container")
    if(!graphContainer) {
        throw new Error("Cannot find graph container")
    }
    const hr = new HistogramRender(new RenderContextSvg(graphContainer))
    /** @type {HTMLInputElement | null} */
    const e = document.querySelector("#import")
    if(!e) {
        throw new Error("Cannot find import container")
    }
    const importer = new EpwImporter(e, hr)

    const retainedData = {
        get units() {
            return this.field.units
        },
    }
    Frameworker.proxy(retainedData, hr, ["noiseReduction", "period", "roundToNearest", "debug", "field", "preferLog", "first24", "graphType"],
        {}, [])

    const f = new Frameworker(retainedData, document, {
        field: {
            /**
             * @type {EpwNamedNumberField[]}
             */
            get options() {
                return EpwFields.filter(field => field instanceof EpwNamedNumberField)
            }
        },
        graphType: {
            get options() {
                return [
                    {name: "Interpolated Histogram", value: 1},
                    {name: "Histogram", value: 0},
                    {name: "Raw", value: -1},
                    {name: "Raw (Day overlap)", value: -2},
                ]
            }
        },
        period: {
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
        }

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