import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import {Injectable} from '@angular/core';
import {BodyPix} from '@tensorflow-models/body-pix';
import {substituteBackground} from '../util/rendering';
import {getAverage, round} from '../util/math';
import {
    BodyPixArchitecture,
    BodyPixInternalResolution,
    BodyPixMultiplier,
    BodyPixOutputStride,
    BodyPixQuantBytes,
} from '@tensorflow-models/body-pix/dist/types';
import {ModelConfig} from '@tensorflow-models/body-pix/dist/body_pix_model';

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
    public internalResolution: BodyPixInternalResolution = 'low';

    private modelConfig: ModelConfig = {
        architecture: 'MobileNetV1',
        multiplier: 0.75,
        outputStride: 16,
        quantBytes: 2,
    };

    get architecture(): string {
        return this.modelConfig.architecture;
    }

    get multiplier(): string {
        return this.modelConfig.multiplier.toString(10);
    }

    get outputStride(): string {
        return this.modelConfig.outputStride.toString(10);
    }

    get quantBytes(): string {
        return this.modelConfig.quantBytes.toString(10);
    }

    set architecture(s: string) {
        this.modelConfig.architecture = s as BodyPixArchitecture;

        if (s === 'ResNet50') {
            if (this.modelConfig.outputStride === 8) this.modelConfig.outputStride = 16;
            this.modelConfig.multiplier = 1;
        }

        if (this.modelConfig.outputStride === 32 && s === 'MobileNetV1') {
            this.modelConfig.outputStride = 16;
        }
    }

    set multiplier(s: string) {
        this.modelConfig.multiplier = parseFloat(s) as BodyPixMultiplier;
    }

    set outputStride(s: string) {
        this.modelConfig.outputStride = parseInt(s, 10) as BodyPixOutputStride;
    }

    set quantBytes(s: string) {
        this.modelConfig.quantBytes = parseInt(s, 10) as BodyPixQuantBytes;
    }

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

        this.net = await bodyPix.load(this.modelConfig);

        this.inited = true;
    }

    async reloadModel(): Promise<void> {
        this.net = await bodyPix.load(this.modelConfig);
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

        let frameStart: number;
        let frameEnd: number;
        const frameTimes: number[] = [];

        while (!this.stop_) {
            frameStart = performance.now();

            if (this.blur) {
                const segmentation = await this.net!.segmentPerson(this.videoElement, {
                    internalResolution: this.internalResolution,
                });

                bodyPix.drawBokehEffect(
                    this.canvas!,
                    this.videoElement,
                    segmentation,
                    this.backgroundBlurAmount,
                    this.edgeBlurAmount,
                    this.flipHorizontal,
                );
            } else if (this.substitute) {
                const segmentation = await this.net!.segmentPerson(this.videoElement, {
                    internalResolution: this.internalResolution,
                });

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

            frameEnd = performance.now();

            const frameTime = frameEnd - frameStart;
            frameTimes.push(frameTime);
            if (frameTimes.length > 50) {
                frameTimes.shift();
            }

            const averageFrametime = getAverage(frameTimes);
            const fps = 1000 / averageFrametime;
            context.font = '35px serif';
            context.fillStyle = '#F0F';
            context.fillText(`${round(fps)} FPS`, 10, 35);
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
            this.substitute_ = false;
        }

        this.blur_ = value;
    }

    get substitute(): boolean {
        return this.substitute_;
    }

    set substitute(value: boolean) {
        if (value && this.blur_) {
            this.blur_ = false;
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
