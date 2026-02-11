/**
 * Auth Provider Component
 * @fileoverview Auth0 integration with protected route support
 */

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { setTokenGetter, setUnauthorizedHandler } from "@shared/api";

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
const AUTH0_CALLBACK_URL =
  import.meta.env.VITE_AUTH0_CALLBACK_URL || window.location.origin;

/**
 * Inner component that sets up the token getter after Auth0 is initialized
 */
function AuthSetup({ children }) {
  const { getAccessTokenSilently, isAuthenticated, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (isAuthenticated) {
      // Set the token getter for Axios interceptor
      setTokenGetter(async () => {
        try {
          return await getAccessTokenSilently();
        } catch (error) {
          console.warn("[Auth] Failed to get token silently:", error);
          return null;
        }
      });

      setUnauthorizedHandler(() => {
        const inAdmin = window.location.pathname.startsWith("/admin");
        if (!inAdmin) return;

        loginWithRedirect({
          appState: {
            returnTo:
              window.location.pathname +
              window.location.search +
              window.location.hash,
          },
        });
      });
    } else {
      // Clear token getter when not authenticated
      setTokenGetter(null);
      setUnauthorizedHandler(null);
    }
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

  return children;
}

/**
 * Auth0 Provider wrapper with navigation support
 */
export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    // Redirect to the intended page after login, default to home
    navigate(appState?.returnTo || "/");
  };

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    console.error(
      "[Auth] Missing Auth0 configuration. Check environment variables.",
    );
    return (
      <div className="p-4 bg-red-100 text-red-800">
        Auth0 configuration missing
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: AUTH0_CALLBACK_URL,
        audience: AUTH0_AUDIENCE,
        scope: "openid profile email offline_access",
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      onRedirectCallback={onRedirectCallback}
    >
      <AuthSetup>{children}</AuthSetup>
    </Auth0Provider>
  );
}

/**
 * Custom hook for auth with role checking
 */
export function useAuth() {
  const auth0 = useAuth0();

  const NS_NEW = "https://n-athar.co/";
  const NS_OLD = "https://athar.co/";

  /**
   * Get roles from ID token claims
   */
  const getRoles = async () => {
    try {
      const claims = await auth0.getIdTokenClaims();
      return claims?.[NS_NEW + "roles"] || claims?.[NS_OLD + "roles"] || [];
    } catch {
      return [];
    }
  };

  /**
   * Check if user is admin
   */
  const isAdmin = async () => {
    const roles = await getRoles();
    return roles.includes("admin");
  };

  /**
   * Get access token for API calls
   * Note: With Axios interceptor, you don't need to call this directly
   * The interceptor automatically adds the token to requests
   */
  const getAccessToken = async () => {
    try {
      return await auth0.getAccessTokenSilently();
    } catch (err) {
      console.warn("[Auth] Failed to get access token silently:", err);
      return null;
    }
  };

  return {
    ...auth0,
    getRoles,
    isAdmin,
    getAccessToken,
  };
}

export { useAuth0 };
