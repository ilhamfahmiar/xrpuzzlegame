/**
 * Test setup — mock Canvas API untuk jsdom environment
 * jsdom tidak mengimplementasikan Canvas 2D API secara penuh,
 * sehingga kita perlu mock getContext dan ImageData.
 */

// ─── Mock ImageData ───────────────────────────────────────────────────────────
// jsdom tidak menyediakan ImageData, kita buat implementasi minimal

if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height || dataOrWidth.length / (widthOrHeight * 4);
      } else {
        // ImageData(width, height)
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      }
    }
  };
}

// ─── Mock Canvas 2D Context ───────────────────────────────────────────────────
// jsdom memiliki canvas element tapi getContext('2d') mengembalikan null
// Kita mock dengan implementasi minimal yang cukup untuk puzzle.js

class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this._canvas = canvas;
    this._imageData = new globalThis.ImageData(
      new Uint8ClampedArray(canvas.width * canvas.height * 4),
      canvas.width,
      canvas.height,
    );
    this.globalAlpha = 1;
    this.shadowColor = "";
    this.shadowBlur = 0;
    this.shadowOffsetY = 0;
    this.strokeStyle = "";
    this.fillStyle = "";
    this.lineWidth = 1;
    this.font = "";
    this._transform = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 };
    this._savedStates = [];
  }

  putImageData(imageData, dx, dy) {
    // Salin data ke internal buffer
    const srcW = imageData.width;
    const srcH = imageData.height;
    const dstW = this._canvas.width;
    const dstH = this._canvas.height;

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const dstX = dx + x;
        const dstY = dy + y;
        if (dstX < 0 || dstX >= dstW || dstY < 0 || dstY >= dstH) continue;
        const srcIdx = (y * srcW + x) * 4;
        const dstIdx = (dstY * dstW + dstX) * 4;
        this._imageData.data[dstIdx] = imageData.data[srcIdx];
        this._imageData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        this._imageData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        this._imageData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
  }

  getImageData(sx, sy, sw, sh) {
    const data = new Uint8ClampedArray(sw * sh * 4);
    const srcW = this._canvas.width;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const srcX = sx + x;
        const srcY = sy + y;
        const srcIdx = (srcY * srcW + srcX) * 4;
        const dstIdx = (y * sw + x) * 4;
        data[dstIdx] = this._imageData.data[srcIdx] || 0;
        data[dstIdx + 1] = this._imageData.data[srcIdx + 1] || 0;
        data[dstIdx + 2] = this._imageData.data[srcIdx + 2] || 0;
        data[dstIdx + 3] = this._imageData.data[srcIdx + 3] || 0;
      }
    }

    return new globalThis.ImageData(data, sw, sh);
  }

  drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh) {
    // Jika source adalah canvas, ambil data dari context-nya
    let srcCtx = null;
    if (source && source._mockCtx) {
      srcCtx = source._mockCtx;
    }

    if (!srcCtx) return;

    const srcW = source.width;
    const dstW = this._canvas.width;
    const dstH = this._canvas.height;

    // Handle overloads: drawImage(img, dx, dy) atau drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
    let _sx, _sy, _sw, _sh, _dx, _dy, _dw, _dh;
    if (dw === undefined) {
      // drawImage(img, dx, dy) atau drawImage(img, dx, dy, dw, dh)
      _sx = 0;
      _sy = 0;
      _sw = source.width;
      _sh = source.height;
      _dx = sx;
      _dy = sy;
      _dw = sw !== undefined ? sw : source.width;
      _dh = sh !== undefined ? sh : source.height;
    } else {
      _sx = sx;
      _sy = sy;
      _sw = sw;
      _sh = sh;
      _dx = dx;
      _dy = dy;
      _dw = dw;
      _dh = dh;
    }

    // Simple nearest-neighbor scaling
    for (let y = 0; y < _dh; y++) {
      for (let x = 0; x < _dw; x++) {
        // Gunakan Math.floor untuk mapping yang konsisten
        const srcX =
          _sw === _dw ? Math.floor(_sx + x) : Math.floor(_sx + (x / _dw) * _sw);
        const srcY =
          _sh === _dh ? Math.floor(_sy + y) : Math.floor(_sy + (y / _dh) * _sh);
        const dstX = Math.floor(_dx + x);
        const dstY = Math.floor(_dy + y);

        if (dstX < 0 || dstX >= dstW || dstY < 0 || dstY >= dstH) continue;
        if (
          srcX < 0 ||
          srcX >= source.width ||
          srcY < 0 ||
          srcY >= source.height
        )
          continue;

        const srcIdx = (srcY * source.width + srcX) * 4;
        const dstIdx = (dstY * dstW + dstX) * 4;

        const srcData = srcCtx._imageData.data;
        this._imageData.data[dstIdx] = srcData[srcIdx];
        this._imageData.data[dstIdx + 1] = srcData[srcIdx + 1];
        this._imageData.data[dstIdx + 2] = srcData[srcIdx + 2];
        this._imageData.data[dstIdx + 3] =
          srcData[srcIdx + 3] !== undefined ? srcData[srcIdx + 3] : 255;
      }
    }
  }

  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  fill() {}
  roundRect() {}
  fillText() {}
  measureText() {
    return { width: 0 };
  }
  setLineDash() {}
  save() {
    this._savedStates.push({
      globalAlpha: this.globalAlpha,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur,
    });
  }
  restore() {
    const state = this._savedStates.pop();
    if (state) {
      this.globalAlpha = state.globalAlpha;
      this.shadowColor = state.shadowColor;
      this.shadowBlur = state.shadowBlur;
    }
  }
  translate() {}
  scale() {}
}

// ─── Patch HTMLCanvasElement.getContext ───────────────────────────────────────

const originalCreateElement = document.createElement.bind(document);
document.createElement = function (tagName, options) {
  const el = originalCreateElement(tagName, options);
  if (tagName.toLowerCase() === "canvas") {
    // Override getContext untuk canvas elements
    el.getContext = function (contextType) {
      if (contextType === "2d") {
        if (!this._mockCtx) {
          this._mockCtx = new MockCanvasRenderingContext2D(this);
        }
        return this._mockCtx;
      }
      return null;
    };

    // Override width/height setters untuk update context
    let _width = 300;
    let _height = 150;
    Object.defineProperty(el, "width", {
      get() {
        return _width;
      },
      set(v) {
        _width = v;
        if (this._mockCtx) {
          this._mockCtx._canvas = this;
          this._mockCtx._imageData = new globalThis.ImageData(
            new Uint8ClampedArray(_width * _height * 4),
            _width,
            _height,
          );
        }
      },
      configurable: true,
    });
    Object.defineProperty(el, "height", {
      get() {
        return _height;
      },
      set(v) {
        _height = v;
        if (this._mockCtx) {
          this._mockCtx._canvas = this;
          this._mockCtx._imageData = new globalThis.ImageData(
            new Uint8ClampedArray(_width * _height * 4),
            _width,
            _height,
          );
        }
      },
      configurable: true,
    });
  }
  return el;
};
