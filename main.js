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
    const importer = new EpwImporter(e, hr)

    const retainedData = {
        get units() {
            return this.field.units
        },
    }
    Frameworker.proxy(retainedData, hr, ["period", "plain", "debug", "field", "preferLog", "first24"],
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