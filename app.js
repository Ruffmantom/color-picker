const canvas = document.getElementById("saturation-brightness");
const ctx = canvas.getContext("2d");
const hueSlider = document.getElementById("hue");
const huePreview = document.getElementById("hue-preview");
const preview = document.getElementById("preview");
const colorValueOutputTitle = document.getElementById("output_name");
const colorValueOutput = document.getElementById("color_value_output");
const colorValueTypeBtn = document.getElementById("color_type_btn")
const addSwatchButton = document.getElementById("add_swatch_button")
const colorNameInput = document.getElementById("color_name_input")
const swatchesContainer = document.querySelector(".swatches_container")

let selectorX = 10;
let selectorY = 10;
let hue = 0;
let isDragging = false;
let colorValues = {
    rgbValues: { name: 'rgb', color: "" },
    hexValues: { name: 'hex', color: "" },
    labValues: { name: 'lab', color: "" },
    cmykValues: { name: 'cmyk', color: "" },
    hslValues: { name: 'hsl', color: "" },
    hsbValues: { name: 'hsb', color: "" }
}
let currentValueType = 'hexValues'
let currentSwatches = []

function generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);         // base36 timestamp
    const random = Math.random().toString(36).substr(2, 5); // 5-char random string
    return `${prefix}-${timestamp}-${random}`;
}


// color value helpers
function hsvToRgb(h, s, v) {
    let f = (n, k = (n + h / 60) % 6) =>
        v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [f(5) * 255, f(3) * 255, f(1) * 255];
}

function rgbToHex(r, g, b) {
    hex = (
        "#" +
        [r, g, b]
            .map(x => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? "0" + hex : hex;
            })
            .join("")
    );
    return hex
}

function rgbToLab(r, g, b) {
    // Convert RGB to XYZ
    function pivot(n) {
        return n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92;
    }
    r = pivot(r / 255);
    g = pivot(g / 255);
    b = pivot(b / 255);

    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    function labPivot(t) {
        return t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t) + 16 / 116;
    }

    const l = (116 * labPivot(y)) - 16;
    const a = 500 * (labPivot(x) - labPivot(y));
    const bVal = 200 * (labPivot(y) - labPivot(z));

    return `${l.toFixed(2)}, ${a.toFixed(2)}, ${bVal.toFixed(2)}`;
}

function rgbToCmyk(r, g, b) {
    const c = 1 - (r / 255);
    const m = 1 - (g / 255);
    const y = 1 - (b / 255);
    const k = Math.min(c, m, y);
    if (k === 1) return "0, 0, 0, 100";
    const cOut = ((c - k) / (1 - k)) * 100;
    const mOut = ((m - k) / (1 - k)) * 100;
    const yOut = ((y - k) / (1 - k)) * 100;
    const kOut = k * 100;
    return `${cOut.toFixed(1)}%, ${mOut.toFixed(1)}%, ${yOut.toFixed(1)}%, ${kOut.toFixed(1)}%`;
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: h = ((b - r) / d + 2); break;
            case b: h = ((r - g) / d + 4); break;
        }
        h /= 6;
    }
    return `${(h * 360).toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%`;
}

function rgbToHsb(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max / 255;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    return `${h.toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(v * 100).toFixed(0)}%`;
}

// html helper
const createColorSwatch = (data) => {
    return `
        <div class="color_swatch">
            <div class="color_swatch_content">
                <div class="color_swatch_preview">
                    <div class="color_swatch_preview_color" style="background-color:${data.swatchAllColorData.hexValues.color}"></div>
                    <div class="color_swatch_preview_value truncate">${data.swatchInfo.name !== "hex" ? `${data.swatchInfo.name}(` : ""}${data.swatchInfo.color}${data.swatchInfo.name !== "hex" ? `)` : ""}</div>
                </div>
                ${data.swatchTitle !== "" ? `<p class="color_swatch_preview_title truncate" title="${data.swatchTitle}">${data.swatchTitle}</p>` : ""}
            </div>
            <button data-id=${data.id} class="color_swatch_remove_btn">X</button>
        </div>
    
    `
}


const renderSwatches = () => {
    swatchesContainer.innerHTML = '';

    if (currentSwatches.length === 0) return;

    currentSwatches.forEach(color => {
        const newSwatch = document.createElement('div');
        newSwatch.innerHTML = createColorSwatch(color);
        swatchesContainer.appendChild(newSwatch);
    });
};


const addSwatch = (newSwatchData) => {
    let newSwatch = document.createElement('div')
    newSwatch.innerHTML = createColorSwatch(newSwatchData)

    swatchesContainer.appendChild(newSwatch)
}


// draw the selector on to the canvas
function drawSelector(x, y) {
    ctx.save(); // Save the current context state

    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();

}


// update on click and drag
function selectColorAt(x, y) {
    selectorX = x;
    selectorY = y;

    const s = x / canvas.width;
    const v = 1 - y / canvas.height;

    const [r, g, b] = hsvToRgb(hue, s, v);
    colorValues.rgbValues.color = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
    colorValues.hexValues.color = rgbToHex(r, g, b);
    colorValues.labValues.color = rgbToLab(r, g, b);
    colorValues.cmykValues.color = rgbToCmyk(r, g, b);
    colorValues.hslValues.color = rgbToHsl(r, g, b);
    colorValues.hsbValues.color = rgbToHsb(r, g, b);

    preview.style.backgroundColor = colorValues.hexValues.color;
    colorValueOutput.textContent = colorValues[currentValueType].color;

    drawSaturationBox();
}

function drawSaturationBox() {
    const width = canvas.width;
    const height = canvas.height;

    // Convert current hue to RGB with full saturation and value
    const [r, g, b] = hsvToRgb(hue, 1, 1);

    // Set base hue color
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, width, height);

    // Add horizontal white gradient (left to right)
    const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
    whiteGrad.addColorStop(0, 'white');
    whiteGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, width, height);

    // Add vertical black gradient (top to bottom)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
    blackGrad.addColorStop(0, 'transparent');
    blackGrad.addColorStop(1, 'black');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);
}


canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = x / canvas.width;
    const v = 1 - y / canvas.height;

    const [r, g, b] = hsvToRgb(hue, s, v);
    const hex = rgbToHex(r, g, b);

    preview.style.backgroundColor = hex;
    colorValueOutput.textContent = colorValues[currentValueType].color;
});


hueSlider.addEventListener("input", () => {
    hue = parseInt(hueSlider.value, 10);
    drawSaturationBox();
    selectColorAt(selectorX, selectorY)
    drawSelector(selectorX, selectorY);

    const [r, g, b] = hsvToRgb(hue, 1, 1);
    hueSlider.style.setProperty('--thumb-color', `rgb(${r},${g},${b})`);
});


// click and drag events for canvas circle
canvas.addEventListener('mousedown', e => {
    isDragging = true;
    const { left, top } = canvas.getBoundingClientRect();
    selectColorAt(e.clientX - left, e.clientY - top);

});

canvas.addEventListener('mousemove', e => {
    if (isDragging) {
        const { left, top } = canvas.getBoundingClientRect();
        selectColorAt(e.clientX - left, e.clientY - top);
        drawSelector(e.clientX - 20, e.clientY - 20);
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// canvas.addEventListener('mouseleave', () => {
//     isDragging = false;
// });

addSwatchButton.addEventListener('click', function (event) {
    event.preventDefault();

    const deepCopy = obj => JSON.parse(JSON.stringify(obj));

    const newSwatch = {
        id: generateId("SWATCH").toUpperCase(),
        swatchTitle: colorNameInput.value,
        swatchInfo: deepCopy(colorValues[currentValueType]),
        swatchAllColorData: deepCopy(colorValues)
    };

    currentSwatches.push(newSwatch);
    renderSwatches();
    colorNameInput.value = "";
});

// switch the view value type
colorValueTypeBtn.addEventListener('click', function (event) {
    event.preventDefault();
    console.log(colorValues)
    const keys = Object.keys(colorValues); // ['rgbValues', 'hexValues', ...]
    const currentIndex = keys.indexOf(currentValueType);
    const nextIndex = (currentIndex + 1) % keys.length;

    currentValueType = keys[nextIndex];

    // Update the output
    const value = `${colorValues[currentValueType].color}`;
    colorValueOutput.textContent = colorValues[currentValueType].color;
    colorValueOutputTitle.textContent = colorValues[currentValueType].name.toUpperCase()
});


// delete swatch
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('color_swatch_remove_btn')) {
        const deleteId = e.target.dataset.id;

        currentSwatches = currentSwatches.filter(s => s.id !== deleteId);

        renderSwatches();
    }
});



// initial draw
colorValueOutputTitle.textContent = colorValues[currentValueType].name.toUpperCase()
drawSaturationBox();
selectColorAt(selectorX, selectorY)
drawSelector(selectorX, selectorY);