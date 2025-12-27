import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";
import { CursorDto } from "./cursor.dto";

export class DateDto extends CursorDto{
    @ApiPropertyOptional({ description: '开始时间', example: '2025-12-12 10:00:00' })
    @IsOptional()
    @IsDateString({}, { message: '开始时间格式不正确' })
    startDate?: string;

    @ApiPropertyOptional({ description: '结束时间', example: '2025-12-12 18:00:00' })
    @IsOptional()
    @IsDateString({}, { message: '结束时间格式不正确' })
    endDate?: string;
}