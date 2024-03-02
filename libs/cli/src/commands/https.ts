import { Command } from "commander";
import { applyDefaultOptions, applyEaseOfUseOptions, applyHttpsOptions, applyOptions, getBaseOptions, openLocalTunnel } from "./base";
import { validateUrl } from "../validators/urlValidator";
import { validateCertificatePaths } from "../validators/pathValidator";

const applyHttpsCommand = applyOptions(
    applyDefaultOptions,
    applyHttpsOptions,
    applyEaseOfUseOptions
)

const getHttpsOptions = (command: Command) => {
    
    const localCert = command.optsWithGlobals().localCert as ReturnType<typeof validateCertificatePaths> | undefined;
    const skipCertificateValidation = command.optsWithGlobals().skipCertVal as boolean;

    return {
        localCert,
        skipCertificateValidation
    }
}

async function callHttpsCommand(_:never, command: Command) {

    const { localHost, remoteHost, subdomain, printRequestInfo, openUrlOnConnect } = getBaseOptions(command);
    const { localCert, skipCertificateValidation } = getHttpsOptions(command);
    
    const https = {
        skipCertificateValidation,
        cert: localCert
    };

    await openLocalTunnel(printRequestInfo, openUrlOnConnect, {
        localHost,
        server: {
            hostName: remoteHost,
            subdomain
        },
        https
    })
}

/** 
 * This function exists to make the cli framework distinguish between http and https,
 * Without having to compromise on typing urls 
 */
export function mapHttpsArgument(arg: string) {

    if (arg === 'https' || arg === 'https://' || arg === 'https://<origin>')
        return ["https://<origin>"]
    
    if (arg.startsWith('https://') && arg.length !== 8)
        return ["https://<origin>", "--origin", arg]

    return arg;
}

export async function registerHttps(program: Command) {

    const { italic } = await import('../format').then(x => x.default());
    
    applyHttpsCommand(program
        .command('https')
        .name('https://<origin>')
        .configureHelp({
            commandDescription(_cmd) {
                return "Open a local-tunnel to a https endpoint \n\n"+
                // Fake the origin argument help text
                "Arguments:\n" +
                `  https://<origin>                                Local origin url, including port when applicable. \n`+
                `                                                  E.g. "https://localhost:4321"`
            },
        })
        .description(
            "Open a local-tunnel to a https endpoint " + italic(`(lt help https)`)
        )
        .addOption(program
            .createOption("--origin <origin>")
            .makeOptionMandatory()
            .argParser(validateUrl)
            .hideHelp(true)
        )
        .action(callHttpsCommand)
    );
}