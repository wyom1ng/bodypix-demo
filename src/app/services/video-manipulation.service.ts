import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import {Injectable} from '@angular/core';
import {BodyPix} from '@tensorflow-models/body-pix';
import {substituteBackground} from '../util/rendering';

@Injectable({
    providedIn: 'root',
})
export class VideoManipulationService {
    private inited = false;

    private net: BodyPix | undefined;

    private backgroundCanvas = document.createElement('canvas');

    private canvas: HTMLCanvasElement | undefined;
    private canvasWidth = 0;
    private canvasHeight = 0;

    private stop_ = false;

    private blur_ = false;
    private substitute_ = false;

    public backgroundBlurAmount = 3;
    public edgeBlurAmount = 3;
    public flipHorizontal = false;

    private videoElement = document.createElement('video');

    constructor() {
        this.videoElement.style.display = 'none';
        this.videoElement.style.objectFit = 'fill';
        this.videoElement.autoplay = true;
        document.body.append(this.videoElement);
    }

    async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
        const constraints = {
            audio: false,
            video: {
                width,
                height,
            },
        };

        this.videoElement.width = width;
        this.videoElement.height = height;
        this.videoElement.srcObject = await window.navigator.mediaDevices.getUserMedia(constraints);

        this.canvas = canvas;
        this.canvasWidth = width;
        this.canvasHeight = height;

        this.backgroundCanvas.width = width;
        this.backgroundCanvas.height = height;

        const backgroundContext = this.backgroundCanvas.getContext('2d')!;
        backgroundContext.fillStyle = '#0F0';
        backgroundContext.fillRect(0, 0, width, height);

        this.net = await bodyPix.load();

        this.inited = true;
    }

    async start() {
        if (!this.inited) {
            throw new Error('Run init(); first');
        }

        this.stop_ = false;

        const context = this.canvas?.getContext('2d');
        if (!context) {
            throw new Error('Could not get 2D context');
        }

        while (!this.stop_) {
            if (this.blur) {
                const segmentation = await this.net!.segmentPerson(this.videoElement);

                bodyPix.drawBokehEffect(
                    this.canvas!,
                    this.videoElement,
                    segmentation,
                    this.backgroundBlurAmount,
                    this.edgeBlurAmount,
                    this.flipHorizontal,
                );
            } else if (this.substitute) {
                const segmentation = await this.net!.segmentPerson(this.videoElement);

                substituteBackground(
                    this.canvas!,
                    this.videoElement,
                    this.backgroundCanvas,
                    segmentation,
                    this.edgeBlurAmount,
                    this.flipHorizontal,
                );
            } else {
                context.drawImage(this.videoElement, 0, 0, this.canvasWidth, this.canvasHeight);
            }

            await tf.nextFrame();
        }

        context.fillStyle = '#000';
        context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    stop() {
        this.stop_ = true;
    }

    get blur(): boolean {
        return this.blur_;
    }

    set blur(value: boolean) {
        if (value && this.substitute_) {
            throw new Error("Can't substitute and blur simultaneously");
        }

        this.blur_ = value;
    }

    get substitute(): boolean {
        return this.substitute_;
    }

    set substitute(value: boolean) {
        if (value && this.blur_) {
            throw new Error("Can't substitute and blur simultaneously");
        }

        this.substitute_ = value;
    }

    setSubstitutionImage(file: File) {
        const backgroundContext = this.backgroundCanvas.getContext('2d')!;

        const self = this;

        const img = new Image();
        img.onload = function () {
            backgroundContext.drawImage(img, 0, 0, self.canvasWidth, self.canvasHeight);
        };
        img.src = URL.createObjectURL(file);
    }
}
