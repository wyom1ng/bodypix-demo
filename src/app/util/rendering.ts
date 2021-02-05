/**
 * Copied from https://github.com/tensorflow/tfjs-models/blob/master/body-pix/src/output_rendering_util.ts
 */

import {cpuBlur} from '@tensorflow-models/body-pix/dist/blur';
import {
    PersonSegmentation,
    SemanticPersonSegmentation,
} from '@tensorflow-models/body-pix/dist/types';
import {getInputSize} from '@tensorflow-models/body-pix/dist/util';
import {toMask} from '@tensorflow-models/body-pix';

const offScreenCanvases: {[name: string]: HTMLCanvasElement} = {};

type ImageType = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function flipCanvasHorizontal(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
}

function drawWithCompositing(
    ctx: CanvasRenderingContext2D,
    image: HTMLCanvasElement | ImageType,
    compositOperation: string,
) {
    ctx.globalCompositeOperation = compositOperation;
    ctx.drawImage(image, 0, 0);
}

function createOffScreenCanvas(): HTMLCanvasElement {
    return document.createElement('canvas');
}

function ensureOffscreenCanvasCreated(id: string): HTMLCanvasElement {
    if (!offScreenCanvases[id]) {
        offScreenCanvases[id] = createOffScreenCanvas();
    }
    return offScreenCanvases[id];
}

function drawAndBlurImageOnCanvas(image: ImageType, blurAmount: number, canvas: HTMLCanvasElement) {
    const {height, width} = image;
    const ctx = canvas.getContext('2d')!;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (isSafari()) {
        cpuBlur(canvas, image, blurAmount);
    } else {
        // tslint:disable:no-any
        (ctx as any).filter = `blur(${blurAmount}px)`;
        ctx.drawImage(image, 0, 0, width, height);
    }
    ctx.restore();
}

function drawAndBlurImageOnOffScreenCanvas(
    image: ImageType,
    blurAmount: number,
    offscreenCanvasName: string,
): HTMLCanvasElement {
    const canvas = ensureOffscreenCanvasCreated(offscreenCanvasName);
    if (blurAmount === 0) {
        renderImageToCanvas(image, canvas);
    } else {
        drawAndBlurImageOnCanvas(image, blurAmount, canvas);
    }
    return canvas;
}

function renderImageToCanvas(image: ImageType, canvas: HTMLCanvasElement) {
    const {width, height} = image;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(image, 0, 0, width, height);
}

/**
 * Draw an image on a canvas
 */
function renderImageDataToCanvas(image: ImageData, canvas: HTMLCanvasElement) {
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;

    ctx.putImageData(image, 0, 0);
}

function renderImageDataToOffScreenCanvas(image: ImageData, canvasName: string): HTMLCanvasElement {
    const canvas = ensureOffscreenCanvasCreated(canvasName);
    renderImageDataToCanvas(image, canvas);

    return canvas;
}

const CANVAS_NAMES = {
    blurred: 'blurred',
    blurredMask: 'blurred-mask',
    mask: 'mask',
    lowresPartMask: 'lowres-part-mask',
};

function createPersonMask(
    multiPersonSegmentation: PersonSegmentation[] | SemanticPersonSegmentation,
    edgeBlurAmount: number,
): HTMLCanvasElement {
    const backgroundMaskImage = toMask(
        multiPersonSegmentation,
        {r: 0, g: 0, b: 0, a: 255},
        {r: 0, g: 0, b: 0, a: 0},
    );

    const backgroundMask = renderImageDataToOffScreenCanvas(backgroundMaskImage, CANVAS_NAMES.mask);
    if (edgeBlurAmount === 0) {
        return backgroundMask;
    } else {
        return drawAndBlurImageOnOffScreenCanvas(
            backgroundMask,
            edgeBlurAmount,
            CANVAS_NAMES.blurredMask,
        );
    }
}

export function substituteBackground(
    output: HTMLCanvasElement,
    image: ImageType,
    background: HTMLCanvasElement,
    multiPersonSegmentation: SemanticPersonSegmentation | PersonSegmentation[],
    edgeBlurAmount = 3,
    flipHorizontal = false,
) {
    output.width = background.width;
    output.height = background.height;

    const ctx = output.getContext('2d')!;

    if (Array.isArray(multiPersonSegmentation) && multiPersonSegmentation.length === 0) {
        ctx.drawImage(background, 0, 0);
        return;
    }

    const personMask = createPersonMask(multiPersonSegmentation, edgeBlurAmount);

    ctx.save();
    if (flipHorizontal) {
        flipCanvasHorizontal(output);
    }
    // draw the original image on the final canvas
    const [height, width] = getInputSize(image);
    ctx.drawImage(image, 0, 0, width, height);

    // "destination-in" - "The existing canvas content is kept where both the
    // new shape and existing canvas content overlap. Everything else is made
    // transparent."
    // crop what's not the person using the mask from the original image
    drawWithCompositing(ctx, personMask, 'destination-in');
    // "destination-over" - "The existing canvas content is kept where both the
    // new shape and existing canvas content overlap. Everything else is made
    // transparent."
    // draw the blurred background on top of the original image where it doesn't
    // overlap.
    drawWithCompositing(ctx, background, 'destination-over');
    ctx.restore();
}
