interface Props {
    children: React.ReactNode,
    id: string,
    sectionStyle?: string,
    className?: string,
    maxWidth?: string,
}

const Container = ({ children, id, sectionStyle, className, maxWidth = "max-w-lg" }: Props) => {
    return (
        <section id={id} className={`${sectionStyle}`}>
            <div className={`${maxWidth} mx-auto py-3 px-3 md:px-0 ${className}`}>
                {children}
            </div>
        </section>
    )
};

export { Container };