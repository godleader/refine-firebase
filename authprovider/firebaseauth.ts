import { AuthProvider } from "@refinedev/core";
import {
    Auth,
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    getIdTokenResult,
    RecaptchaParameters,
    RecaptchaVerifier,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateEmail,
    updatePassword,
    updateProfile,
    User as FirebaseUser
} from "firebase/auth";
import { FirebaseApp } from "firebase/app";
import { AuthActionResponse, CheckResponse } from "@refinedev/core/dist/contexts/auth/types";

export interface IAuthCallbacks {
    onLogin?: (user: FirebaseUser) => void;
    onRegister?: (user: FirebaseUser) => void;
    onLogout?: (auth: Auth) => void;
}

export interface ILoginArgs {
    email: string;
    password: string;
    remember: boolean;
}

export interface IRegisterArgs {
    email: string;
    password: string;
    displayName?: string;
}

export interface IUser {
    email: string;
    name: string;
}

export class FirebaseAuth {
    private auth: Auth;

    constructor(private readonly authActions?: IAuthCallbacks, firebaseApp?: FirebaseApp, auth?: Auth) {
        this.auth = auth || getAuth(firebaseApp);
        this.auth.useDeviceLanguage();
    }

    public async handleLogOut(): Promise<AuthActionResponse> {
        try {
            await signOut(this.auth);
            this.authActions?.onLogout?.(this.auth);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: { name: "Logout Error", message: error.message } };
        }
    }

    public async handleRegister(args: IRegisterArgs): Promise<AuthActionResponse> {
        try {
            const { email, password, displayName } = args;
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            await sendEmailVerification(userCredential.user);

            if (userCredential.user) {
                if (displayName) {
                    await updateProfile(userCredential.user, { displayName });
                }
                this.authActions?.onRegister?.(userCredential.user);
                return { success: true }; 
            } else {
                throw new Error('User credential not found after registration.');
            }
        } catch (error: any) {
            return { success: false, error: { name: "Registration Error", message: error.message } };
        }
    }

    public async handleLogIn({ email, password, remember }: ILoginArgs): Promise<AuthActionResponse> {
        try {
            let persistence = browserSessionPersistence;
            if (remember) {
                persistence = browserLocalPersistence;
            }
            await this.auth.setPersistence(persistence);

            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            const userToken = await userCredential?.user?.getIdToken?.();
            if (userToken) {
                this.authActions?.onLogin?.(userCredential.user);
                return { success: true }; 
            } else {
                throw new Error("User is not found");
            }
        } catch (error: any) {
            return { success: false, error: { name: "Login Error", message: error.message } };
        }
    }

    public async handleResetPassword(email: string): Promise<void> {
        await sendPasswordResetEmail(this.auth, email);
    }

    public async onUpdateUserData(args: IRegisterArgs): Promise<void> {
        try {
            if (this.auth?.currentUser) {
                const { displayName, email, password } = args;
                if (password) {
                    await updatePassword(this.auth.currentUser, password);
                }
                if (email && this.auth.currentUser.email !== email) {
                    await updateEmail(this.auth.currentUser, email);
                }
                if (displayName && this.auth.currentUser.displayName !== displayName) {
                    await updateProfile(this.auth.currentUser, { displayName });
                }
            }
        } catch (error) {
            throw error;
        }
    }

    public async getUserIdentity(): Promise<IUser> {
        try {
            const user = this.auth?.currentUser;
            return {
                email: user?.email || "",
                name: user?.displayName || ""
            };
        } catch (error) {
            throw error;
        }
    }

    public async handleCheckAuth(): Promise<CheckResponse> {
        try {
            const user = await this.getFirebaseUser();
            if (!user) {
                throw new Error("User is not found");
            }
            return {
                authenticated: true
            };
        } catch (error: any) {
            return {
                authenticated: false,
                error: { name: "Check Auth Error", message: error.message }
            };
        }
    }

    public async handleForgotPassword(email: string): Promise<AuthActionResponse> {
        try {
            await sendPasswordResetEmail(this.auth, email);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: { name: "Forgot Password Error", message: error.message } };
        }
    }

    public async handleUpdatePassword(newPassword: string): Promise<AuthActionResponse> {
        try {
            if (this.auth?.currentUser) {
                await updatePassword(this.auth.currentUser, newPassword);
                return { success: true };
            } else {
                throw new Error("No user is currently authenticated");
            }
        } catch (error: any) {
            return { success: false, error: { name: "Update Password Error", message: error.message } };
        }
    }

    public async getPermissions(): Promise<ParsedToken> {
        try {
            const user = this.auth.currentUser;
            if (!user) {
                throw new Error("No user is currently authenticated");
            }

            const idTokenResult = await getIdTokenResult(user);
            return idTokenResult?.claims || {};
        } catch (error) {
            throw error;
        }
    }

    public createRecaptcha(containerOrId: string | HTMLDivElement, parameters?: RecaptchaParameters): RecaptchaVerifier {
        return new RecaptchaVerifier(containerOrId, parameters, this.auth);
    }

    public async getFirebaseUser(): Promise<FirebaseUser | null> {
        return new Promise<FirebaseUser | null>((resolve, reject) => {
            const unsubscribe = this.auth.onAuthStateChanged(user => {
                unsubscribe();
                resolve(user);
            }, reject);
        });
    }

    public getAuthProvider(): AuthProvider {
        return {
            login: this.handleLogIn.bind(this),
            logout: this.handleLogOut.bind(this),
            check: this.handleCheckAuth.bind(this),
            onError: async() => {
                return {
                    redirectTo: "/",
                    logout: false,
                    error: { name: "Error", message: "An error occurred", stack: "Error stack" }
                };
            },
            register: this.handleRegister.bind(this),
            forgotPassword: this.handleForgotPassword.bind(this),
            updatePassword: this.handleUpdatePassword.bind(this),
            getPermissions: this.getPermissions.bind(this),
            getIdentity: this.getUserIdentity.bind(this)
        };
    }
}

