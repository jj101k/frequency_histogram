const hr = new HistogramRender(document.querySelector("#graph-container"))
/** @type {HTMLInputElement} */
const e = document.querySelector("#import")
e.onchange = async function() {
    if(e.files) {
        const fr = new FileReader()
        fr.onload = () => {
            if(typeof fr.result != "string") throw new Error("Wrong result type?")
            const r = new EpwParser(fr.result).getValues("dewPoint")
            console.log(r)
            const h = new Histogram(r, 0.05)

            hr.render(h)
        }
        fr.readAsText(e.files[0])
    }
}