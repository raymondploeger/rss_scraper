export interface AppUser {
  id: string;
  email: string;
  createdAt?: Date;
}

export interface Feed {
  id: string;
  userId: string;
  title: string;
  url: string;
  createdAt?: Date;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  description: string;
  link: string;
  pubDate?: Date;
  imageUrl?: string;
  read: boolean;
  favorite: boolean;
  createdAt?: Date;
}
