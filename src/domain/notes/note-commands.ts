export interface ListNotesDTO {
  search?: string;
}

export interface CreateNoteDTO {
  idUser: string;
  idSourceMessage?: string;
  name: string;
  markdown?: string;
}

export interface UpdateNoteDTO {
  idUser: string;
  id: string;
  name?: string;
  markdown?: string;
}
