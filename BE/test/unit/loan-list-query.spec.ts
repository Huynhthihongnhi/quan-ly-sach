import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminLoanListQueryDto,
  OwnLoanListQueryDto,
} from '../../src/modules/circulation/dto/loan-list-query.dto';

describe('loan list query DTO', () => {
  it('parses overdue=true from query strings', async () => {
    const dto = plainToInstance(OwnLoanListQueryDto, { overdue: 'true', page: '1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.overdue).toBe(true);
  });

  it('rejects invalid loan state filters', async () => {
    const dto = plainToInstance(AdminLoanListQueryDto, { state: 'overdue' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
