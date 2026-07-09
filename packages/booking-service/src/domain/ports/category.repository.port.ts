export interface ICategoryRepository {
  findAllForAi(): Promise<Array<{ id: string; name: string; examples: string[] }>>;
  findById(id: string): Promise<{ id: string; name: string } | null>;
}
