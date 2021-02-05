import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {VideoManipulationService} from '../../services/video-manipulation.service';
import {MatCheckboxChange} from '@angular/material/checkbox';

@Component({
    selector: 'app-video-output',
    templateUrl: './video-output.component.html',
    styleUrls: ['./video-output.component.scss'],
})
export class VideoOutputComponent implements AfterViewInit {
    public width = 720;
    public height = 480;

    @ViewChild('canvas', {static: true}) canvas: ElementRef<HTMLCanvasElement> | undefined;

    constructor(public manipulationService: VideoManipulationService) {}

    ngAfterViewInit() {
        this.onResolutionUpdate();
    }

    async onResolutionUpdate(): Promise<void> {
        if (!this.canvas) return;

        this.canvas.nativeElement.width = this.width;
        this.canvas.nativeElement.height = this.height;

        await this.manipulationService.init(this.canvas.nativeElement, this.width, this.height);
    }

    async onVideoChange(event: MatCheckboxChange): Promise<void> {
        if (event.checked) {
            await this.manipulationService.start();
        } else {
            this.manipulationService.stop();
        }
    }

    onFileChange(event: any) {
        if (!event.target.files.length) return;

        this.manipulationService.setSubstitutionImage(event.target.files[0]);
    }
}
