interface Props {
    children: React.ReactNode,
    id: string,
    sectionStyle?: string,
    className?: string,
    maxWidth?: string,
    padding?: string,
}

const Container = ({ children, id, sectionStyle, className, maxWidth = "max-w-lg", padding = "py-3 px-3 md:px-0" }: Props) => {
    return (
        <section id={id} className={`${sectionStyle}`}>
            <div className={`${maxWidth} mx-auto ${padding} ${className} w-full`}>
                {children}
            </div>
        </section>
    )
};

export { Container };