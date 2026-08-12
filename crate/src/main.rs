mod cli;
mod extract;
mod mcp;
mod scan;
mod walk;

#[cfg(test)]
mod fuzz;
#[cfg(test)]
mod testing;

fn main() -> std::process::ExitCode {
    cli::run()
}
