// Mock for next/navigation — used by Navbar, explore page, etc.
export const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
  refresh: jest.fn(),
}));

export const usePathname = jest.fn(() => "/");

export const useSearchParams = jest.fn(() => ({
  get: jest.fn().mockReturnValue(null),
  getAll: jest.fn().mockReturnValue([]),
  has: jest.fn().mockReturnValue(false),
  toString: jest.fn().mockReturnValue(""),
}));

export const redirect = jest.fn();
export const notFound = jest.fn();
