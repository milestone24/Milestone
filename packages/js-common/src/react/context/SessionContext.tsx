import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import type { SessionUser } from "../../schema";
import { useStorage } from "../../platform/PlatformServicesProvider";

const PROFILE_IMAGE_KEY = "profileImage";

interface SessionState {
  user: SessionUser | null;
  isLoginLoading: boolean;
  isInitialUserLoading: boolean;
  isInitialUserLoadFailed: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  profileImage: string | null;
}

export type SessionAction =
  | { type: "LOGIN_LOADING" }
  | { type: "LOGIN_COMPLETE" }
  | { type: "INITIAL_USER_LOADING" }
  | { type: "INITIAL_USER_LOADED"; payload: SessionUser | null }
  | { type: "INITIAL_USER_LOAD_FAILED" }
  | { type: "AUTH_SUCCESS"; payload: SessionUser }
  | { type: "AUTH_ERROR"; payload: Error }
  | { type: "AUTH_LOGOUT" }
  | { type: "AUTH_INITIALIZED" }
  | { type: "UPDATE_PROFILE_IMAGE"; payload: string | null };

const initialState: SessionState = {
  user: null,
  isLoginLoading: false,
  isInitialUserLoading: true,
  isInitialUserLoadFailed: false,
  error: null,
  isAuthenticated: false,
  isInitialized: false,
  profileImage: null,
};

interface SessionContextType {
  user: SessionUser | null;
  isLoginLoading: boolean;
  isInitialUserLoading: boolean;
  isInitialUserLoadFailed: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  profileImage: string | null;
}

const sessionReducer = (
  state: SessionState,
  action: SessionAction
): SessionState => {
  switch (action.type) {
    case "LOGIN_LOADING":
      return { ...state, isLoginLoading: true, error: null };
    case "LOGIN_COMPLETE":
      return { ...state, isLoginLoading: false };
    case "INITIAL_USER_LOADING":
      return {
        ...state,
        isInitialUserLoading: true,
        isInitialUserLoadFailed: false,
      };
    case "INITIAL_USER_LOADED":
      return {
        ...state,
        isInitialUserLoading: false,
        isInitialUserLoadFailed: false,
        ...(action.payload
          ? {
              user: action.payload,
              isAuthenticated: true,
            }
          : {}),
      };
    case "INITIAL_USER_LOAD_FAILED":
      return {
        ...state,
        isInitialUserLoading: false,
        isInitialUserLoadFailed: true,
        isAuthenticated: false,
      };
    case "AUTH_SUCCESS":
      return {
        ...state,
        isLoginLoading: false,
        isInitialUserLoading: false,
        isInitialUserLoadFailed: false,
        isAuthenticated: true,
        user: action.payload,
        error: null,
      };
    case "AUTH_ERROR":
      return {
        ...state,
        isLoginLoading: false,
        isInitialUserLoading: false,
        error: action.payload,
      };
    case "AUTH_LOGOUT":
      return {
        ...state,
        isLoginLoading: false,
        isInitialUserLoading: false,
        isInitialUserLoadFailed: false,
        isAuthenticated: false,
        user: null,
        error: null,
      };
    case "AUTH_INITIALIZED":
      return {
        ...state,
        isInitialized: true,
        isInitialUserLoading: false,
      };
    case "UPDATE_PROFILE_IMAGE":
      return {
        ...state,
        profileImage: action.payload,
      };
    default:
      return state;
  }
};

const SessionStateContext = createContext<SessionState | undefined>(undefined);
const SessionDispatchContext = createContext<
  React.Dispatch<SessionAction> | undefined
>(undefined);
const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const savedProfileImage = await storage.getItem(PROFILE_IMAGE_KEY);
      if (!cancelled && savedProfileImage) {
        dispatch({ type: "UPDATE_PROFILE_IMAGE", payload: savedProfileImage });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storage]);

  return (
    <SessionStateContext.Provider value={state}>
      <SessionDispatchContext.Provider value={dispatch}>
        <SessionContext.Provider
          value={{
            user: state.user,
            isLoginLoading: state.isLoginLoading,
            isInitialUserLoading: state.isInitialUserLoading,
            isInitialUserLoadFailed: state.isInitialUserLoadFailed,
            error: state.error,
            isAuthenticated: state.isAuthenticated,
            profileImage: state.profileImage,
          }}
        >
          {children}
        </SessionContext.Provider>
      </SessionDispatchContext.Provider>
    </SessionStateContext.Provider>
  );
}

export function useSessionState() {
  const context = useContext(SessionStateContext);
  if (context === undefined) {
    throw new Error("useSessionState must be used within a SessionProvider");
  }
  return context;
}

export function useSessionDispatch() {
  const context = useContext(SessionDispatchContext);
  if (context === undefined) {
    throw new Error("useSessionDispatch must be used within a SessionProvider");
  }
  return context;
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}

export async function persistProfileImage(
  storage: { setItem: (key: string, value: string) => void | Promise<void>; removeItem: (key: string) => void | Promise<void> },
  image: string | null
): Promise<void> {
  if (image) {
    await storage.setItem(PROFILE_IMAGE_KEY, image);
  } else {
    await storage.removeItem(PROFILE_IMAGE_KEY);
  }
}
